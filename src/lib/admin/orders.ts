import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { escapeLike } from "@/lib/api/search";
import type { Db } from "@/lib/lists/product";
import { sendOrderCancelled, sendOrderShipped } from "@/lib/orders/notify";
import { orderViewSelect, toOrderView } from "@/lib/orders/queries";
import type { CancelReason, OrderStatus, OrderView } from "@/lib/orders/types";
import { recordMercadoPagoPaymentEvent } from "@/lib/orders/mercadopago";
import { asOrderPayments, providerOf, type OrderPayments } from "@/lib/orders/payments";
import { restock } from "@/lib/orders/webhook";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { orderRefundKey, paymentRefOf, refundColumnOf, refundRefOf } from "@/lib/payments/provider";
import { ADMIN_PAGE_SIZE, type AdminOrderFilters, type OrderTransitionInput } from "@/lib/validations/admin";
import { recordAudit, type AuditActor } from "./audit";
import { canTransition, pageCount, storeDayEnd, storeDayStart, type Page } from "./format";

/*
 * Orders in the admin panel: the list and its filters, one order with its
 * payment and audit trail, and the status changes an admin can make
 * (./format.ts ADMIN_TRANSITIONS, from the design doc):
 *
 *   PENDING | PAYMENT_PENDING -> CANCELLED
 *                          the payment is cancelled with the provider too
 *                          (Stripe's PaymentIntent, Mercado Pago's pending
 *                          payment or ticket); refused while a payment is
 *                          going through (the webhook settles it)
 *   PAID    -> SHIPPED     emails the customer ("Tu pedido está en camino")
 *   PAID    -> CANCELLED   full refund through the order's provider + the
 *                          stock goes back, atomically
 *   SHIPPED -> DELIVERED
 *
 * Shipped and delivered orders cannot be cancelled, and PAID is only ever
 * set by the provider (a webhook, or Mercado Pago's own answer). Payments go
 * through the provider that took the order (Order.paymentProvider), via the
 * provider-neutral interface (src/lib/payments/provider.ts). Client first,
 * like the rest of the server code; no permission checks here (./actions.ts
 * checks the admin).
 *
 * Every change first locks the order's row (as the checkout and the webhook
 * do, so none of them interleave) and checks the status the admin saw: a
 * second click, a retry or another admin finds the order already moved and
 * changes nothing. Cancelling a PAID order holds the order before asking
 * Stripe for the refund, so whatever happens to that call (no answer, a
 * timeout) the order cannot ship for money that went back (cancelPaid
 * below). Each change is recorded in OrderStatusChange (who, when, from
 * what to what, and the refund: the order page's timeline) and in the
 * general audit log (./audit.ts), in the same transaction.
 */

type Tx = Prisma.TransactionClient;

/** Room for the provider's round trips inside a transaction that holds an order's lock (as in checkout.ts). */
const LOCKED_TX = { timeout: 30_000, maxWait: 10_000 } as const;


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
export function orderWhere(filters: AdminOrderFilters): Prisma.OrderWhereInput {
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

/** What the provider said about one of the order's payments (PaymentEvent), for the admin's history. */
export interface PaymentEventView {
  id: string;
  paymentId: string;
  status: string;
  statusDetail: string | null;
  source: string;
  at: string;
}

export interface AdminOrderView extends OrderView {
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  /** The provider's payment and refund ids (Stripe's PaymentIntent and refund, or Mercado Pago's). */
  paymentId: string | null;
  refundId: string | null;
  /** The provider's own status of the latest payment ("approved", "pending"...) and its detail. */
  paymentStatus: string | null;
  paymentStatusDetail: string | null;
  paymentEvents: PaymentEventView[];
  /** PAID, but a cancellation asked Stripe for a refund whose outcome is unknown: it cannot ship until cancelled again. */
  refundPending: boolean;
  /** The account that placed it (null for guests). */
  account: { id: string; email: string; name: string | null } | null;
  /** The coupon it used (its admin page) and where that use stands. */
  coupon: { id: string; redemption: "RESERVED" | "REDEEMED" | "RELEASED" } | null;
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
      providerPaymentId: true,
      providerRefundId: true,
      paymentStatus: true,
      paymentStatusDetail: true,
      refundRequestedAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true, name: true } },
      couponRedemption: { select: { couponId: true, status: true } },
      paymentEvents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, paymentId: true, status: true, statusDetail: true, source: true, createdAt: true },
      },
      statusChanges: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, fromStatus: true, toStatus: true, actorEmail: true, refundId: true, createdAt: true },
      },
    },
  });
  if (!row) return null;
  const {
    stripePaymentIntentId,
    stripeRefundId,
    providerPaymentId,
    providerRefundId,
    paymentStatus,
    paymentStatusDetail,
    refundRequestedAt,
    updatedAt,
    user,
    couponRedemption,
    statusChanges,
    paymentEvents,
    ...view
  } = row;
  const ids = { paymentProvider: view.paymentProvider, stripePaymentIntentId, stripeRefundId, providerPaymentId, providerRefundId };
  return {
    ...toOrderView(view),
    stripePaymentIntentId,
    stripeRefundId,
    paymentId: paymentRefOf(ids),
    refundId: refundRefOf(ids),
    paymentStatus,
    paymentStatusDetail,
    paymentEvents: paymentEvents.map((event) => ({
      id: event.id,
      paymentId: event.paymentId,
      status: event.status,
      statusDetail: event.statusDetail,
      source: event.source,
      at: event.createdAt.toISOString(),
    })),
    refundPending: view.status === "PAID" && refundRequestedAt !== null,
    account: user,
    coupon: couponRedemption ? { id: couponRedemption.couponId, redemption: couponRedemption.status } : null,
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

export type Actor = AuditActor;

const AUDIT_ACTION = { SHIPPED: "order.ship", DELIVERED: "order.deliver", CANCELLED: "order.cancel" } as const;

export type TransitionResult =
  /** `changed: false`: the order already had that status (a repeated click): nothing was done. */
  | { ok: true; changed: boolean; status: OrderStatus; restockedProductIds: string[]; refundId: string | null }
  | { ok: false; reason: "not_found" }
  /** The order moved since the admin loaded it; `status` is the current one. */
  | { ok: false; reason: "conflict"; status: OrderStatus }
  | { ok: false; reason: "not_allowed"; status: OrderStatus }
  /** Pending, but its payment is going through: the webhook will settle it (PAID, then it can be cancelled). */
  | { ok: false; reason: "payment_in_flight" }
  | { ok: false; reason: "payments_unconfigured" }
  /** The provider made no refund (it refused, and has none for the payment): the order is as it was. */
  | { ok: false; reason: "refund_failed" }
  /**
   * The provider did not answer, and could not be asked whether the refund went
   * through: the order stays PAID but held (it cannot be shipped) until a
   * retry of the cancellation settles it.
   */
  | { ok: false; reason: "refund_unknown" }
  /** Shipping an order held by a refund of unknown outcome: cancel it again to settle it. */
  | { ok: false; reason: "refund_pending" }
  /** A paid order without a payment to refund (never happens through checkout). */
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
      paymentProvider: true,
      stripePaymentIntentId: true,
      stripeRefundId: true,
      providerPaymentId: true,
      providerRefundId: true,
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

async function recordChange(tx: Tx, input: OrderTransitionInput, from: OrderStatus, actor: Actor, refundId: string | null) {
  await tx.orderStatusChange.create({
    data: { orderId: input.orderId, fromStatus: from, toStatus: input.to, actorId: actor.id, actorEmail: actor.email.toLowerCase(), refundId },
  });
  await recordAudit(tx, actor, {
    action: AUDIT_ACTION[input.to],
    entityType: "order",
    entityId: input.orderId,
    changes: { status: [from, input.to], ...(refundId ? { refundId } : {}) },
  });
}

/** Cancels a pending order's payment with its provider, unless a payment is already going through. */
async function cancelPendingPayment(payments: OrderPayments, order: LockedOrder) {
  const paymentId = paymentRefOf(order);
  if (!paymentId) return;
  const provider = providerOf(payments, order.paymentProvider);
  if (!provider) throw new Abort({ ok: false, reason: "payments_unconfigured" });
  // "in_flight": it went through (or is going through) meanwhile: the webhook settles the order.
  if ((await provider.cancelPayment(paymentId)) === "in_flight") throw new Abort({ ok: false, reason: "payment_in_flight" });
}

/** PAID -> SHIPPED, SHIPPED -> DELIVERED and PENDING | PAYMENT_PENDING -> CANCELLED: one transaction under the order's lock. */
async function changeInOneGo(db: PrismaClient, payments: OrderPayments, input: OrderTransitionInput, actor: Actor) {
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
          await cancelPendingPayment(payments, order);
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
 * PAID -> CANCELLED: the refund with the provider, then the stock back and the
 * status, in three steps so that no outcome of the refund call leaves the
 * order able to ship for money that went back:
 *
 * 1. under the lock, the order is held: refundRequestedAt is committed
 *    before the provider is asked, and a held order cannot be shipped;
 * 2. the refund, with the order's idempotency key (a retry, a second admin
 *    or the webhook all get the same single refund). If the call fails, the
 *    provider is asked whether the payment has a refund anyway (the answer
 *    lost on the way back): if so the cancellation goes on with it; if it
 *    has none, the hold is lifted and nothing changed; if the provider cannot
 *    be reached at all, the order stays held until the admin retries;
 * 3. under the lock again, the stock goes back, the order is CANCELLED with
 *    the refund, and the change is recorded. If someone finished it first
 *    (a second click, another admin) this changes nothing.
 */
async function cancelPaid(db: PrismaClient, payments: OrderPayments, input: OrderTransitionInput, actor: Actor): Promise<TransitionResult> {
  type Held = { paymentId: string; refundId: string | null; provider: LockedOrder["paymentProvider"] };
  const held = await db.$transaction(async (tx): Promise<TransitionResult | Held> => {
    const order = await lockOrder(tx, input.orderId);
    const early = precheck(order, input);
    if (early || !order) return early!;
    const paymentId = paymentRefOf(order);
    if (!paymentId) return { ok: false, reason: "no_payment" };
    if (!providerOf(payments, order.paymentProvider)) return { ok: false, reason: "payments_unconfigured" };
    if (!order.refundRequestedAt) await tx.order.update({ where: { id: input.orderId }, data: { refundRequestedAt: new Date() } });
    return { paymentId, refundId: refundRefOf(order), provider: order.paymentProvider };
  });
  if ("ok" in held) return held;
  const provider = providerOf(payments, held.provider)!;
  const refundColumn = refundColumnOf(held.provider);

  let refundId = held.refundId;
  if (!refundId) {
    try {
      refundId = (await provider.refund(held.paymentId, { idempotencyKey: orderRefundKey(input.orderId) })).id;
    } catch (error) {
      console.error(`[admin] Falló el reembolso del pedido ${input.orderId}:`, error);
      let found: { id: string } | null;
      try {
        found = await provider.findRefund(held.paymentId);
      } catch (lookupError) {
        console.error(`[admin] No se pudo consultar el reembolso del pedido ${input.orderId}; queda retenido:`, lookupError);
        return { ok: false, reason: "refund_unknown" };
      }
      if (!found) {
        // No refund exists: the order is exactly as it was, and may ship again.
        await db.order.updateMany({ where: { id: input.orderId, status: "PAID", [refundColumn]: null }, data: { refundRequestedAt: null } });
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
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: "admin" satisfies CancelReason,
        [refundColumn]: refundId,
        // The whole payment went back: Mercado Pago's status says so now (its notification may never reach this server).
        ...(order.paymentProvider === "MERCADOPAGO" ? { paymentStatus: "refunded", paymentStatusDetail: "refunded" } : {}),
      },
    });
    if (order.paymentProvider === "MERCADOPAGO" && order.providerPaymentId) {
      // The payment's history shows the refund now; Mercado Pago's notification of it, when it comes, is the same entry.
      await recordMercadoPagoPaymentEvent(tx, input.orderId, { id: order.providerPaymentId, status: "refunded", statusDetail: "refunded" }, "admin");
    }
    await recordChange(tx, input, "PAID", actor, refundId);
    return { ok: true, changed: true, status: "CANCELLED", restockedProductIds, refundId };
  }, LOCKED_TX);
}

/**
 * Moves an order to `input.to` if the admin may (see the top of the file),
 * records who did it, and emails the customer when it ships or when a paid
 * order is cancelled (refunded). Safe to repeat.
 */
export async function changeOrderStatus(
  db: PrismaClient,
  /** Each provider's client (a bare Stripe gateway means Stripe only, as before Mercado Pago). */
  payments: PaymentGateway | OrderPayments | null,
  input: OrderTransitionInput,
  actor: Actor
): Promise<TransitionResult> {
  const clients = asOrderPayments(payments);
  // `expected` is the status the admin saw; any other one is a conflict either way.
  const result =
    input.to === "CANCELLED" && input.expected === "PAID"
      ? await cancelPaid(db, clients, input, actor)
      : await changeInOneGo(db, clients, input, actor);

  // After the commit: the email never undoes the change (sendEmail logs its own failures).
  if (result.ok && result.changed && result.status === "SHIPPED") await sendOrderShipped(db, input.orderId);
  if (result.ok && result.changed && result.status === "CANCELLED" && input.expected === "PAID") {
    await sendOrderCancelled(db, input.orderId);
  }
  return result;
}
