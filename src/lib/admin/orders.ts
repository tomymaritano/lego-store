import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { escapeLike } from "@/lib/api/search";
import type { Db } from "@/lib/lists/product";
import { sendOrderShipped } from "@/lib/orders/notify";
import { orderViewSelect, toOrderView } from "@/lib/orders/queries";
import type { CancelReason, OrderStatus, OrderView } from "@/lib/orders/types";
import { restock } from "@/lib/orders/webhook";
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
 * Every change first locks the order's row (as the checkout and the webhook
 * do, so none of them interleave) and checks the status the admin saw: a
 * second click, a retry or another admin finds the order already moved and
 * changes nothing. Cancelling a PAID order holds the order before asking
 * Stripe for the refund, so whatever happens to that call (no answer, a
 * timeout) the order cannot ship for money that went back (cancelPaid
 * below). Each change is recorded in OrderStatusChange: who, when, from
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

/**
 * The list shows placed orders ("Realizar pedido", submittedAt set), as the
 * dashboard counts them; checkouts that never got there (a PENDING draft with
 * its PaymentIntent, or one the cleanup cancelled) only under the "draft"
 * filter. Dates are the store calendar days of when the order was placed
 * (orderPlacedAt: submittedAt, or createdAt for a draft), the date the table
 * shows and "Pedidos de hoy" counts.
 */
function orderWhere(filters: AdminOrderFilters): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (filters.status === "draft") and.push({ submittedAt: null });
  else if (filters.status === "amount_mismatch") and.push({ status: "CANCELLED", cancelReason: "amount_mismatch" });
  else {
    and.push({ submittedAt: { not: null } });
    if (filters.status) and.push({ status: filters.status });
  }
  if (filters.q) {
    const number = orderNumberOf(filters.q);
    and.push({
      OR: [{ email: { contains: escapeLike(filters.q.toLowerCase()) } }, ...(number !== null ? [{ number }] : [])],
    });
  }
  if (filters.from || filters.to) {
    const range: Prisma.DateTimeFilter = {
      ...(filters.from ? { gte: storeDayStart(filters.from) } : {}),
      ...(filters.to ? { lt: storeDayEnd(filters.to) } : {}),
    };
    and.push({ OR: [{ submittedAt: range }, { submittedAt: null, createdAt: range }] });
  }
  return { AND: and };
}

/** One page of orders, the last placed first (drafts after them, newest first). */
export async function listAdminOrders(db: Db, filters: AdminOrderFilters): Promise<Page<AdminOrderRow>> {
  const where = orderWhere(filters);
  const total = await db.order.count({ where });
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.order.findMany({
    where,
    orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
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
  /** PAID, but a cancellation asked Stripe for a refund whose outcome is unknown: it cannot ship until cancelled again. */
  refundPending: boolean;
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
      refundRequestedAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true, name: true } },
      statusChanges: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, fromStatus: true, toStatus: true, actorEmail: true, refundId: true, createdAt: true },
      },
    },
  });
  if (!row) return null;
  const { stripePaymentIntentId, stripeRefundId, refundRequestedAt, updatedAt, user, statusChanges, ...view } = row;
  return {
    ...toOrderView(view),
    stripePaymentIntentId,
    stripeRefundId,
    refundPending: view.status === "PAID" && refundRequestedAt !== null,
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
  /** Stripe made no refund (it refused, and has none for the payment): the order is as it was. */
  | { ok: false; reason: "refund_failed" }
  /**
   * Stripe did not answer, and could not be asked whether the refund went
   * through: the order stays PAID but held (it cannot be shipped) until a
   * retry of the cancellation settles it.
   */
  | { ok: false; reason: "refund_unknown" }
  /** Shipping an order held by a refund of unknown outcome: cancel it again to settle it. */
  | { ok: false; reason: "refund_pending" }
  /** A paid order without a PaymentIntent to refund (never happens through checkout). */
  | { ok: false; reason: "no_payment" };

type Failure = Extract<TransitionResult, { ok: false }>;

class Abort extends Error {
  constructor(readonly result: Failure) {
    super(result.reason);
  }
}

const unchanged = (status: OrderStatus): TransitionResult => ({ ok: true, changed: false, status, restockedProductIds: [], refundId: null });

/** Locks the order's row for this transaction (as the checkout and the webhook do) and reads it. */
async function lockOrder(tx: Tx, orderId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  if (locked.length === 0) return null;
  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      status: true,
      stripePaymentIntentId: true,
      stripeRefundId: true,
      refundRequestedAt: true,
      items: { select: { productId: true, quantity: true } },
    },
  });
}

type LockedOrder = NonNullable<Awaited<ReturnType<typeof lockOrder>>>;

/** What every change checks first, under the lock: the result to return, or null to go ahead. */
function precheck(order: LockedOrder | null, input: OrderTransitionInput): TransitionResult | null {
  if (!order) return { ok: false, reason: "not_found" };
  if (order.status === input.to) return unchanged(order.status);
  if (order.status !== input.expected) return { ok: false, reason: "conflict", status: order.status };
  if (!canTransition(order.status, input.to)) return { ok: false, reason: "not_allowed", status: order.status };
  return null;
}

function recordChange(tx: Tx, input: OrderTransitionInput, from: OrderStatus, actor: Actor, refundId: string | null) {
  return tx.orderStatusChange.create({
    data: { orderId: input.orderId, fromStatus: from, toStatus: input.to, actorId: actor.id, actorEmail: actor.email.toLowerCase(), refundId },
  });
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

/** PAID -> SHIPPED, SHIPPED -> DELIVERED and PENDING -> CANCELLED: one transaction under the order's lock. */
async function changeInOneGo(db: PrismaClient, gateway: PaymentGateway | null, input: OrderTransitionInput, actor: Actor) {
  try {
    return await db.$transaction(async (tx): Promise<TransitionResult> => {
      const order = await lockOrder(tx, input.orderId);
      const early = precheck(order, input);
      if (early || !order) return early!;
      const now = new Date();
      switch (input.to) {
        case "SHIPPED":
          // A refund was asked for and its outcome is unknown: the money may be back with the customer.
          if (order.refundRequestedAt) return { ok: false, reason: "refund_pending" };
          await tx.order.update({ where: { id: input.orderId }, data: { status: "SHIPPED", shippedAt: now } });
          break;
        case "DELIVERED":
          await tx.order.update({ where: { id: input.orderId }, data: { status: "DELIVERED", deliveredAt: now } });
          break;
        case "CANCELLED":
          await cancelPendingPayment(gateway, order.stripePaymentIntentId);
          await tx.order.update({
            where: { id: input.orderId },
            data: { status: "CANCELLED", cancelledAt: now, cancelReason: "admin" satisfies CancelReason },
          });
          break;
      }
      await recordChange(tx, input, order.status, actor, null);
      return { ok: true, changed: true, status: input.to, restockedProductIds: [], refundId: null };
    }, LOCKED_TX);
  } catch (error) {
    if (error instanceof Abort) return error.result;
    throw error;
  }
}

/**
 * PAID -> CANCELLED: the refund in Stripe, then the stock back and the
 * status, in three steps so that no outcome of the refund call leaves the
 * order able to ship for money that went back:
 *
 * 1. under the lock, the order is held: refundRequestedAt is committed
 *    before Stripe is asked, and a held order cannot be shipped;
 * 2. the refund, with the order's idempotency key (a retry, a second admin
 *    or the webhook all get the same single refund). If the call fails,
 *    Stripe is asked whether the payment has a refund anyway (the answer
 *    lost on the way back): if so the cancellation goes on with it; if it
 *    has none, the hold is lifted and nothing changed; if Stripe cannot be
 *    reached at all, the order stays held until the admin retries;
 * 3. under the lock again, the stock goes back, the order is CANCELLED with
 *    the refund, and the change is recorded. If someone finished it first
 *    (a second click, another admin) this changes nothing.
 */
async function cancelPaid(db: PrismaClient, gateway: PaymentGateway | null, input: OrderTransitionInput, actor: Actor): Promise<TransitionResult> {
  const held = await db.$transaction(async (tx): Promise<TransitionResult | { intentId: string; refundId: string | null }> => {
    const order = await lockOrder(tx, input.orderId);
    const early = precheck(order, input);
    if (early || !order) return early!;
    if (!order.stripePaymentIntentId) return { ok: false, reason: "no_payment" };
    if (!gateway) return { ok: false, reason: "payments_unconfigured" };
    if (!order.refundRequestedAt) await tx.order.update({ where: { id: input.orderId }, data: { refundRequestedAt: new Date() } });
    return { intentId: order.stripePaymentIntentId, refundId: order.stripeRefundId };
  });
  if ("ok" in held) return held;

  let refundId = held.refundId;
  if (!refundId) {
    try {
      refundId = (await gateway!.refund(held.intentId, refundKey(input.orderId))).id;
    } catch (error) {
      console.error(`[admin] Falló el reembolso del pedido ${input.orderId}:`, error);
      let found: { id: string } | null;
      try {
        found = await gateway!.findRefund(held.intentId);
      } catch (lookupError) {
        console.error(`[admin] No se pudo consultar el reembolso del pedido ${input.orderId}; queda retenido:`, lookupError);
        return { ok: false, reason: "refund_unknown" };
      }
      if (!found) {
        // No refund exists: the order is exactly as it was, and may ship again.
        await db.order.updateMany({ where: { id: input.orderId, status: "PAID", stripeRefundId: null }, data: { refundRequestedAt: null } });
        return { ok: false, reason: "refund_failed" };
      }
      refundId = found.id;
    }
  }

  return db.$transaction(async (tx): Promise<TransitionResult> => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) return { ok: false, reason: "not_found" };
    if (order.status === "CANCELLED") return unchanged(order.status);
    // A held order does not ship, and PAID never goes back to PENDING: not expected to happen.
    if (order.status !== "PAID") return { ok: false, reason: "conflict", status: order.status };
    const restockedProductIds = await restock(tx, order.items);
    await tx.order.update({
      where: { id: input.orderId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "admin" satisfies CancelReason, stripeRefundId: refundId },
    });
    await recordChange(tx, input, "PAID", actor, refundId);
    return { ok: true, changed: true, status: "CANCELLED", restockedProductIds, refundId };
  }, LOCKED_TX);
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
  // `expected` is the status the admin saw; any other one is a conflict either way.
  const result =
    input.to === "CANCELLED" && input.expected === "PAID"
      ? await cancelPaid(db, gateway, input, actor)
      : await changeInOneGo(db, gateway, input, actor);

  // After the commit: the email never undoes the change (sendEmail logs its own failures).
  if (result.ok && result.changed && result.status === "SHIPPED") await sendOrderShipped(db, input.orderId);
  return result;
}
