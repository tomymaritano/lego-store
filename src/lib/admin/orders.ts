import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { escapeLike } from "@/lib/api/search";
import type { Db } from "@/lib/lists/product";
import { sendOrderShipped } from "@/lib/orders/notify";
import { orderViewSelect, toOrderView } from "@/lib/orders/queries";
import type { CancelReason, OrderStatus, OrderView } from "@/lib/orders/types";
import type { IntentStatus, PaymentGateway } from "@/lib/payments/gateway";
import { ADMIN_PAGE_SIZE, type AdminOrderFilters, type OrderTransitionInput } from "@/lib/validations/admin";
import { canTransition, pageCount, storeDayEnd, storeDayStart, type Page } from "./format";

/*
 * Orders in the admin panel: the list and its filters, one order with its
 * payment and audit trail, and the status changes an admin can make
 * (./format.ts ADMIN_TRANSITIONS, from the design doc):
 *
 *   PENDING -> CANCELLED   the PaymentIntent is cancelled too; refused while
 *                          a payment is under way (the webhook settles it)
 *   PAID    -> SHIPPED     emails the customer ("Tu pedido está en camino")
 *   PAID    -> CANCELLED   refund in Stripe + the stock goes back, atomically
 *   SHIPPED -> DELIVERED
 *
 * Shipped and delivered orders cannot be cancelled, and PAID is only ever
 * set by Stripe's webhook. Client first, like the rest of the server code;
 * no permission checks here (./actions.ts checks the admin).
 *
 * Every change runs in one transaction that first locks the order's row (as
 * the checkout and the webhook do, so none of them interleave) and checks
 * the status the admin saw: a second click, a retry or another admin finds
 * the order already moved and changes nothing. Cancelling a PAID order puts
 * the stock back and asks Stripe for the refund inside that transaction: if
 * the refund fails, nothing is saved and the admin can try again; if the
 * refund went through but the commit did not, the retry asks again with the
 * same idempotency key and Stripe answers with the same refund (never a
 * second one). Each change is recorded in OrderStatusChange: who, when, from
 * what to what, and the refund.
 */

type Tx = Prisma.TransactionClient;

/** Room for Stripe's round trips inside a transaction that holds an order's lock (as in checkout.ts). */
const LOCKED_TX = { timeout: 30_000, maxWait: 10_000 } as const;

const PAYMENT_IN_FLIGHT: readonly IntentStatus[] = ["processing", "succeeded", "requires_capture"];

/** The refund's idempotency key: the same one the webhook would use, so an order is refunded at most once. */
export const refundKey = (orderId: string) => `order/${orderId}/refund`;

// ---------------------------------------------------------------------------
// List and detail
// ---------------------------------------------------------------------------

export interface AdminOrderRow {
  id: string;
  number: number;
  status: OrderStatus;
  cancelReason: CancelReason | null;
  email: string;
  customer: string;
  hasAccount: boolean;
  total: number;
  itemCount: number;
  createdAt: string;
  submittedAt: string | null;
}

/** "LEGO-001001", "lego-1001", "1001" -> 1001. */
function orderNumberOf(query: string): number | null {
  const match = /^(?:lego-?)?0*(\d{1,9})$/i.exec(query.trim());
  return match ? Number(match[1]) : null;
}

function orderWhere(filters: AdminOrderFilters): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (filters.status === "amount_mismatch") and.push({ status: "CANCELLED", cancelReason: "amount_mismatch" });
  else if (filters.status) and.push({ status: filters.status });
  if (filters.q) {
    const number = orderNumberOf(filters.q);
    and.push({
      OR: [{ email: { contains: escapeLike(filters.q.toLowerCase()) } }, ...(number !== null ? [{ number }] : [])],
    });
  }
  if (filters.from) and.push({ createdAt: { gte: storeDayStart(filters.from) } });
  if (filters.to) and.push({ createdAt: { lt: storeDayEnd(filters.to) } });
  return { AND: and };
}

/** One page of orders, newest first. */
export async function listAdminOrders(db: Db, filters: AdminOrderFilters): Promise<Page<AdminOrderRow>> {
  const where = orderWhere(filters);
  const total = await db.order.count({ where });
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      number: true,
      status: true,
      cancelReason: true,
      email: true,
      firstName: true,
      lastName: true,
      userId: true,
      total: true,
      createdAt: true,
      submittedAt: true,
      items: { select: { quantity: true } },
    },
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      cancelReason: row.cancelReason as CancelReason | null,
      email: row.email,
      customer: `${row.firstName} ${row.lastName}`.trim(),
      hasAccount: row.userId !== null,
      total: row.total,
      itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: row.createdAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
    })),
    total,
    page,
    totalPages,
  };
}

export interface StatusChangeView {
  id: string;
  from: OrderStatus;
  to: OrderStatus;
  actorEmail: string;
  refundId: string | null;
  at: string;
}

export interface AdminOrderView extends OrderView {
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  /** The account that placed it (null for guests). */
  account: { id: string; email: string; name: string | null } | null;
  updatedAt: string;
  history: StatusChangeView[];
}

/** One order, any customer's, with what the admin needs (payment ids, account, audit trail). */
export async function getAdminOrder(db: Db, id: string): Promise<AdminOrderView | null> {
  const row = await db.order.findUnique({
    where: { id },
    select: {
      ...orderViewSelect,
      stripePaymentIntentId: true,
      stripeRefundId: true,
      updatedAt: true,
      user: { select: { id: true, email: true, name: true } },
      statusChanges: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, fromStatus: true, toStatus: true, actorEmail: true, refundId: true, createdAt: true },
      },
    },
  });
  if (!row) return null;
  const { stripePaymentIntentId, stripeRefundId, updatedAt, user, statusChanges, ...view } = row;
  return {
    ...toOrderView(view),
    stripePaymentIntentId,
    stripeRefundId,
    account: user,
    updatedAt: updatedAt.toISOString(),
    history: statusChanges.map((change) => ({
      id: change.id,
      from: change.fromStatus,
      to: change.toStatus,
      actorEmail: change.actorEmail,
      refundId: change.refundId,
      at: change.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

export interface Actor {
  id: string;
  email: string;
}

export type TransitionResult =
  /** `changed: false`: the order already had that status (a repeated click): nothing was done. */
  | { ok: true; changed: boolean; status: OrderStatus; restockedProductIds: string[]; refundId: string | null }
  | { ok: false; reason: "not_found" }
  /** The order moved since the admin loaded it; `status` is the current one. */
  | { ok: false; reason: "conflict"; status: OrderStatus }
  | { ok: false; reason: "not_allowed"; status: OrderStatus }
  /** PENDING whose payment is going through: the webhook will settle it (PAID, then it can be cancelled). */
  | { ok: false; reason: "payment_in_flight" }
  | { ok: false; reason: "payments_unconfigured" }
  /** Stripe refused or did not answer: nothing changed. */
  | { ok: false; reason: "refund_failed" }
  /** A paid order without a PaymentIntent to refund (never happens through checkout). */
  | { ok: false; reason: "no_payment" };

class Abort extends Error {
  constructor(readonly result: Extract<TransitionResult, { ok: false }>) {
    super(result.reason);
  }
}

/** Puts back the stock a paid order took (the reverse of takeStock in src/lib/orders/webhook.ts). */
async function restock(tx: Tx, items: { productId: string | null; quantity: number }[]): Promise<string[]> {
  // Deleted products have nothing to go back to; the same product never repeats in an order.
  const lines = items.filter((item): item is { productId: string; quantity: number } => item.productId !== null);
  const ids = lines.map((line) => line.productId).sort();
  if (ids.length === 0) return [];
  // Same lock order as the webhook (by id), so a payment and a cancellation never deadlock.
  await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ANY(${ids}::text[]) ORDER BY "id" FOR UPDATE`;
  const quantity = new Map(lines.map((line) => [line.productId, line.quantity]));
  for (const id of ids) {
    await tx.$executeRaw`UPDATE "Product" SET "stock" = "stock" + ${quantity.get(id)!}, "updatedAt" = now() WHERE "id" = ${id}`;
  }
  return ids;
}

/** Cancels a pending order's PaymentIntent, unless a payment is already going through it. */
async function cancelPendingPayment(gateway: PaymentGateway | null, intentId: string | null) {
  if (!intentId) return;
  if (!gateway) throw new Abort({ ok: false, reason: "payments_unconfigured" });
  const intent = await gateway.retrieveIntent(intentId);
  if (PAYMENT_IN_FLIGHT.includes(intent.status)) throw new Abort({ ok: false, reason: "payment_in_flight" });
  if (intent.status === "canceled") return;
  try {
    await gateway.cancelIntent(intentId);
  } catch (error) {
    // It moved on meanwhile (a payment went through): the webhook settles the order.
    console.warn(`[admin] No se pudo cancelar el pago ${intentId}:`, error);
    throw new Abort({ ok: false, reason: "payment_in_flight" });
  }
}

/**
 * Moves an order to `input.to` if the admin may (see the top of the file),
 * records who did it, and emails the customer when it ships. Safe to repeat.
 */
export async function changeOrderStatus(
  db: PrismaClient,
  gateway: PaymentGateway | null,
  input: OrderTransitionInput,
  actor: Actor
): Promise<TransitionResult> {
  let result: TransitionResult;
  try {
    result = await db.$transaction(async (tx): Promise<TransitionResult> => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
      if (locked.length === 0) return { ok: false, reason: "not_found" };
      const order = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        select: {
          status: true,
          stripePaymentIntentId: true,
          stripeRefundId: true,
          items: { select: { productId: true, quantity: true } },
        },
      });
      const from = order.status;
      if (from === input.to) return { ok: true, changed: false, status: from, restockedProductIds: [], refundId: null };
      if (from !== input.expected) return { ok: false, reason: "conflict", status: from };
      if (!canTransition(from, input.to)) return { ok: false, reason: "not_allowed", status: from };

      const now = new Date();
      let restockedProductIds: string[] = [];
      let refundId: string | null = null;
      switch (input.to) {
        case "SHIPPED":
          await tx.order.update({ where: { id: input.orderId }, data: { status: "SHIPPED", shippedAt: now } });
          break;
        case "DELIVERED":
          await tx.order.update({ where: { id: input.orderId }, data: { status: "DELIVERED", deliveredAt: now } });
          break;
        case "CANCELLED":
          if (from === "PENDING") {
            await cancelPendingPayment(gateway, order.stripePaymentIntentId);
          } else {
            // PAID: the money goes back and so does the stock, all or nothing.
            if (!order.stripePaymentIntentId) return { ok: false, reason: "no_payment" };
            if (!gateway) return { ok: false, reason: "payments_unconfigured" };
            restockedProductIds = await restock(tx, order.items);
            if (order.stripeRefundId) {
              refundId = order.stripeRefundId;
            } else {
              try {
                refundId = (await gateway.refund(order.stripePaymentIntentId, refundKey(input.orderId))).id;
              } catch (error) {
                console.error(`[admin] Falló el reembolso del pedido ${input.orderId}:`, error);
                throw new Abort({ ok: false, reason: "refund_failed" });
              }
            }
          }
          await tx.order.update({
            where: { id: input.orderId },
            data: { status: "CANCELLED", cancelledAt: now, cancelReason: "admin" satisfies CancelReason, stripeRefundId: refundId ?? undefined },
          });
          break;
      }
      await tx.orderStatusChange.create({
        data: { orderId: input.orderId, fromStatus: from, toStatus: input.to, actorId: actor.id, actorEmail: actor.email.toLowerCase(), refundId },
      });
      return { ok: true, changed: true, status: input.to, restockedProductIds, refundId };
    }, LOCKED_TX);
  } catch (error) {
    if (error instanceof Abort) return error.result;
    throw error;
  }

  // After the commit: the email never undoes the change (sendEmail logs its own failures).
  if (result.ok && result.changed && result.status === "SHIPPED") await sendOrderShipped(db, input.orderId);
  return result;
}
