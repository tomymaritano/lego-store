import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { relaxOrderCoupon, secureOrderCoupon, type CouponCustomer } from "@/lib/coupons/server";
import type { CouponRejection } from "@/lib/coupons/rules";
import type { OrderTotals } from "@/lib/pricing";
import { cancelMercadoPagoPayment, mercadoPagoEvent, mercadoPagoProvider } from "@/lib/payments/mercadopago/provider";
import { fullRefundOf, mapMercadoPagoStatus, mercadoPagoPaymentStage, rejectionMessage } from "@/lib/payments/mercadopago/status";
import { orderRefundKey, type NormalizedPaymentEvent } from "@/lib/payments/provider";
import { MercadoPagoRequestError, type MercadoPagoClient, type MpPayment, type MpPaymentRequest } from "@/lib/payments/mercadopago/types";
import type { PrepareMercadoPagoOrderInput, PayMercadoPagoOrderInput } from "@/lib/validations/orders";
import { accessSelect, canAccessOrder, hashAccessToken, newAccessToken, type Requester } from "./access";
import {
  CouponRefusedError,
  LOCKED_TX,
  couponRefused,
  lockOrderRow,
  orderDataOf,
  priceLines,
  retireOrder,
  writeOrderWithCoupon,
  type PrepareOutcome,
} from "./checkout";
import { formatOrderNumber, isCardPaymentType } from "./format";
import { mercadoPagoNotificationUrl, publicUrl, type OrderPayments } from "./payments";
import { getOrderView } from "./queries";
import type { CancelReason, OrderView, UnavailableLine } from "./types";
import { restock, takeStock } from "./webhook";

/*
 * The checkout and the payment life of a Mercado Pago order (the design doc,
 * "Pagos: Mercado Pago principal"). Same shape as Stripe's (./checkout.ts):
 *
 * 1. prepareMercadoPagoOrder, on "Revisar": prices the lines from the
 *    database, checks the stock, validates and reserves the coupon, and
 *    creates (or updates) this browser's PENDING order with the discounted
 *    total. Mercado Pago has nothing to set up before the payment.
 * 2. payMercadoPagoOrder, on "Realizar pedido": the only call that charges.
 *    First the coupon's limits are checked again and its use is held until
 *    the order settles (secureOrderCoupon; a refused payment lets it go back
 *    to a short hold, and Checkout Pro only renews the short hold, its
 *    preference expiring with it: the payment's report checks the coupon
 *    again before the order is paid or waits on it).
 *    Card and cash: creates the payment from the Payment Brick's formData,
 *    for the order's total (never the browser's amount), with
 *    external_reference = the order id, our notification_url and an
 *    idempotency key per attempt. "Cuenta de Mercado Pago": creates a
 *    Checkout Pro preference and the browser goes to pay there.
 *
 * Whatever Mercado Pago says about a payment afterwards (its answer to the
 * create, a webhook notification, the return from Checkout Pro, the cleanup)
 * goes through applyMercadoPagoPayment, under the order's row lock:
 *
 *   approved      PENDING | PAYMENT_PENDING -> PAID, taking the stock
 *                 atomically and clearing the account's cart; a Checkout Pro
 *                 payment whose coupon no longer fits (secureOrderCoupon):
 *                 refund -> CANCELLED (coupon_unavailable); when a line is
 *                 short, or the order's own pending payment was approved for
 *                 another amount: refund -> CANCELLED. A payment for an amount
 *                 that is not the order's total while the order is still at
 *                 the checkout (a Checkout Pro preference for the total
 *                 before the cart changed, paid late), approved after the
 *                 order was cancelled, or a second payment of a paid order:
 *                 refunded, and the order stays as it is.
 *   pending /     PENDING -> PAYMENT_PENDING (a cash ticket to pay, with its
 *   in_process    link and expiry; a card under review; a Checkout Pro one
 *                 whose coupon no longer fits: the payment is cancelled
 *                 -> CANCELLED); in_mediation (a
 *                 dispute opened) of a paid order: only recorded
 *   rejected      PENDING stays PENDING (the customer is shown why and tries
 *                 again); a PAYMENT_PENDING one -> CANCELLED (rejected after review)
 *   cancelled     PENDING | PAYMENT_PENDING -> CANCELLED (an expired ticket, ...)
 *   refunded      PAID -> CANCELLED with the stock back (a refund made in
 *                 Mercado Pago); shipped orders only record it; an admin's
 *                 cancellation in progress finishes it itself
 *   charged_back  PAID -> CANCELLED with the stock back; shipped: recorded
 *   charged_back  / reimbursed (the store won the dispute): only recorded, for
 *                 the admin. Never refunded (Mercado Pago refuses to refund a
 *                 charged-back payment, and the money is the store's again);
 *                 a cancelled order stays cancelled
 *
 * Each (payment, status, detail) is applied once: PaymentEvent's unique key
 * is claimed in the same transaction, so retried and repeated notifications,
 * and a webhook arriving after the checkout already applied the answer, do
 * nothing. Notifications carry no status of their own: the webhook reads the
 * payment from the API, so it always applies the payment's current status and
 * an old one arriving late cannot move the order back. Payments of an attempt
 * that is no longer the order's (a rejected card before the approved one) only
 * go into the history.
 *
 * No stock is held while a payment is pending (stock is taken when the money
 * is in). The coupon's use is: reserved since "Revisar", redeemed when the
 * order becomes PAID and released whenever it becomes CANCELLED (rejected
 * after review, an expired ticket, a refund, a chargeback), by the coupons
 * migration's trigger on the order's status.
 */

type Tx = Prisma.TransactionClient;
/** A Mercado Pago payment as the provider reports it (src/lib/payments/mercadopago/provider.ts). */
type MpEvent = NormalizedPaymentEvent<MpPayment>;
type Source = "checkout" | "webhook" | "return" | "expire" | "admin";

/** The refund of a payment that is not the order's (a second payment, one after the order was cancelled). */
const strayRefundKey = (orderId: string, paymentId: string) => `order/${orderId}/refund/${paymentId}`;

// ---------------------------------------------------------------------------
// Prepare ("Revisar")
// ---------------------------------------------------------------------------

export async function prepareMercadoPagoOrder(
  db: PrismaClient,
  payments: OrderPayments,
  input: PrepareMercadoPagoOrderInput,
  requester: Requester
): Promise<PrepareOutcome> {
  const priced = await priceLines(db, input.lines);
  if (!priced.ok) return { ok: false, code: "unavailable", unavailable: priced.unavailable };
  const { lines } = priced;
  // No payment yet: what it will be paid with is recorded when Mercado Pago answers.
  const dataOf = (totals: OrderTotals) => ({ ...orderDataOf(input.shipping, totals), paymentBrand: null, paymentLast4: null });
  const customer: CouponCustomer = { userId: requester.userId, email: input.shipping.email.trim().toLowerCase() };

  try {
    const current = requester.access
      ? await db.order.findUnique({
          where: { id: requester.access.orderId },
          select: { ...accessSelect, paymentProvider: true, stripePaymentIntentId: true, providerPaymentId: true },
        })
      : null;
    if (current && current.status === "PENDING" && canAccessOrder(current, requester)) {
      const reused =
        current.paymentProvider === "MERCADOPAGO" && current.userId === requester.userId
          ? await db.$transaction(async (tx): Promise<{ supersededPreference: string | null } | null> => {
              if (!(await lockOrderRow(tx, current.id))) return null;
              const locked = await tx.order.findUnique({ where: { id: current.id }, select: { status: true, providerCheckoutId: true } });
              if (locked?.status !== "PENDING") return null;
              await writeOrderWithCoupon(tx, { lines, couponCode: input.couponCode, customer, orderId: current.id }, async (totals) => {
                // A Checkout Pro preference was for the old lines and total: the next payment makes a new one.
                await tx.order.update({ where: { id: current.id }, data: { ...dataOf(totals), providerCheckoutId: null, providerCheckoutUrl: null } });
                await tx.orderItem.deleteMany({ where: { orderId: current.id } });
                await tx.orderItem.createMany({ data: lines.map((line) => ({ ...line, orderId: current.id })) });
                return { id: current.id };
              });
              return { supersededPreference: locked.providerCheckoutId };
            }, LOCKED_TX)
          : null;
      if (reused) {
        if (reused.supersededPreference) await expirePreference(payments.mercadopago, reused.supersededPreference);
        return { ok: true, order: (await getOrderView(db, current.id))!, access: null };
      }
      // Another account's, or a Stripe order from before the switch: a new order replaces it.
      await retireAnyOrder(db, payments, current, "superseded");
    }

    const token = newAccessToken();
    // The order and its coupon's reservation commit together (or not at all, when the coupon is refused).
    const { order } = await db.$transaction(
      (tx) =>
        writeOrderWithCoupon(tx, { lines, couponCode: input.couponCode, customer }, (totals) =>
          tx.order.create({
            data: {
              ...dataOf(totals),
              paymentProvider: "MERCADOPAGO",
              userId: requester.userId,
              checkoutTokenHash: hashAccessToken(token),
              items: { create: lines },
            },
            select: { id: true },
          })
        ),
      LOCKED_TX
    );
    return { ok: true, order: (await getOrderView(db, order.id))!, access: { orderId: order.id, token } };
  } catch (error) {
    if (error instanceof CouponRefusedError) return couponRefused(error);
    throw error;
  }
}

/**
 * Closes a replaced Checkout Pro preference, so the customer (another tab, an
 * old link) can no longer pay the old total. Best effort: if Mercado Pago
 * cannot be reached, a payment of it still never settles the order (an amount
 * that is not the order's total is refunded and the order stays at the
 * checkout: applyLocked).
 */
async function expirePreference(mp: MercadoPagoClient | null, preferenceId: string) {
  if (!mp) return;
  try {
    await mp.expirePreference(preferenceId);
  } catch (error) {
    console.warn(`[mercadopago] No se pudo cerrar la preferencia ${preferenceId}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Pay ("Realizar pedido")
// ---------------------------------------------------------------------------

export type MercadoPagoPayOutcome =
  | { ok: true; next: "done"; order: OrderView; applied: ApplyOutcome }
  | { ok: true; next: "redirect"; url: string; order: OrderView }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "not_pending"; order: OrderView }
  | { ok: false; code: "unavailable"; unavailable: UnavailableLine[] }
  | { ok: false; code: "declined" | "payment_method"; message: string }
  /** The coupon's place was taken (its hold lapsed) or this email used it up: prepare the order again without it. */
  | { ok: false; code: "coupon"; rejection: CouponRejection; message: string };

/** The Brick's data is not usable any more (a spent or expired card token, a method Mercado Pago refused). */
export const PAYMENT_DATA_MESSAGE = "Vuelve a ingresar los datos del medio de pago.";

/** How long a Checkout Pro preference without a coupon can be paid (one with a coupon: while its use is held). */
const PREFERENCE_TTL_MS = 24 * 60 * 60 * 1000;

export async function payMercadoPagoOrder(
  db: PrismaClient,
  mp: MercadoPagoClient,
  orderId: string,
  input: PayMercadoPagoOrderInput,
  requester: Requester,
  { siteUrl }: { siteUrl?: string } = {}
): Promise<MercadoPagoPayOutcome> {
  return db.$transaction(async (tx): Promise<MercadoPagoPayOutcome> => {
    if (!(await lockOrderRow(tx, orderId))) return { ok: false, code: "not_found" };
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        ...accessSelect,
        number: true,
        email: true,
        firstName: true,
        lastName: true,
        total: true,
        paymentProvider: true,
        providerCheckoutId: true,
        providerCheckoutUrl: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order || !canAccessOrder(order, requester)) return { ok: false, code: "not_found" };
    const view = async () => (await getOrderView(tx, order.id))!;
    if (order.status !== "PENDING" || order.paymentProvider !== "MERCADOPAGO") return { ok: false, code: "not_pending", order: await view() };

    // Fail before charging when the stock is already gone (the approval re-checks atomically).
    const wanted = order.items.flatMap((item) => (item.productId ? [{ productId: item.productId, quantity: item.quantity }] : []));
    const priced = wanted.length === order.items.length ? await priceLines(tx, wanted) : null;
    if (!priced || !priced.ok) return { ok: false, code: "unavailable", unavailable: priced && !priced.ok ? priced.unavailable : [] };

    const number = formatOrderNumber(order.number);
    const notificationUrl = mercadoPagoNotificationUrl(siteUrl) ?? undefined;

    // Before any money moves: the coupon still fits its limits.
    const secured = await secureOrderCoupon(tx, order.id, { extend: input.method !== "wallet" });
    if (!secured.ok) return { ok: false, code: "coupon", rejection: secured.rejection, message: secured.message };

    if (input.method === "wallet") {
      // With a coupon, the preference can be paid only while its use is held (the hold just renewed, `heldUntil`):
      // each click opens a new one until then, and the old one is closed. A payment of it that still comes in
      // later is checked again when Mercado Pago reports it (applyLocked).
      const { heldUntil } = secured;
      if (!heldUntil && order.providerCheckoutId && order.providerCheckoutUrl) {
        // The same preference while the total stands (re-preparing clears it): a second click opens the same payment.
        return { ok: true, next: "redirect", url: order.providerCheckoutUrl, order: await view() };
      }
      if (heldUntil && order.providerCheckoutId) await expirePreference(mp, order.providerCheckoutId);
      const back = publicUrl(`/checkout/pedido/${order.id}`, siteUrl);
      const preference = await mp.createPreference({
        external_reference: order.id,
        items: [{ id: order.id, title: `Pedido LEGO Store ${number}`, quantity: 1, unit_price: order.total, currency_id: "ARS" }],
        payer: { email: order.email },
        back_urls: { success: back, pending: back, failure: back },
        auto_return: "approved",
        notification_url: notificationUrl,
        statement_descriptor: "LEGO STORE",
        expires: true,
        expiration_date_to: (heldUntil ?? new Date(Date.now() + PREFERENCE_TTL_MS)).toISOString(),
      });
      await tx.order.update({ where: { id: order.id }, data: { providerCheckoutId: preference.id, providerCheckoutUrl: preference.initPoint } });
      return { ok: true, next: "redirect", url: preference.initPoint, order: await view() };
    }

    const form = input.formData!;
    const request: MpPaymentRequest = {
      // The order's total, computed by the server when it was prepared: never the Brick's amount.
      transaction_amount: order.total,
      description: `Pedido LEGO Store ${number}`,
      payment_method_id: form.payment_method_id,
      ...(input.method === "card" ? { token: form.token, installments: form.installments ?? 1, issuer_id: form.issuer_id } : {}),
      external_reference: order.id,
      notification_url: notificationUrl,
      statement_descriptor: "LEGO STORE",
      metadata: { order_id: order.id, order_number: number },
      payer: {
        email: form.payer?.email ?? order.email,
        first_name: form.payer?.first_name || order.firstName,
        last_name: form.payer?.last_name || order.lastName,
        ...(form.payer?.identification ? { identification: form.payer.identification } : {}),
      },
    };

    let payment: MpPayment;
    try {
      payment = await mp.createPayment(request, `order/${order.id}/mp/${input.attemptId}`);
    } catch (error) {
      if (error instanceof MercadoPagoRequestError) {
        console.warn(`[mercadopago] Mercado Pago rechazó el pedido de pago de ${order.id}:`, error.message);
        await relaxOrderCoupon(tx, order.id);
        return { ok: false, code: "payment_method", message: PAYMENT_DATA_MESSAGE };
      }
      throw error;
    }

    const applied = await applyLocked(tx, mp, order.id, mercadoPagoEvent(payment), "checkout");
    // A retried request gets the same payment back (the idempotency key): "duplicate", but still a rejection.
    const failed = applied.result === "declined" || (applied.result === "duplicate" && mapMercadoPagoStatus(payment.status) === "failed");
    if (failed) {
      await relaxOrderCoupon(tx, order.id);
      return { ok: false, code: "declined", message: rejectionMessage(payment.statusDetail) };
    }
    if (applied.result === "cancelled" || applied.result === "ignored" || applied.result === "coupon_unavailable") return { ok: false, code: "not_pending", order: await view() };
    return { ok: true, next: "done", order: await view(), applied };
  }, LOCKED_TX);
}

// ---------------------------------------------------------------------------
// What Mercado Pago says about a payment
// ---------------------------------------------------------------------------

export type ApplyOutcome =
  | { result: "ignored" }
  | { result: "duplicate"; orderId: string }
  | { result: "unchanged"; orderId: string }
  | { result: "paid"; orderId: string; productIds: string[] }
  | { result: "pending"; orderId: string }
  /** Rejected while the customer is at the checkout: they try again. */
  | { result: "declined"; orderId: string }
  /** Will not be paid (rejected after review, cancelled, an expired ticket): CANCELLED, nothing charged. */
  | { result: "cancelled"; orderId: string; lapsed: boolean }
  /** Approved, but a line was short / the amount was not the order's: refunded, CANCELLED. */
  | { result: "out_of_stock"; orderId: string }
  | { result: "amount_mismatch"; orderId: string }
  /**
   * A Checkout Pro payment for an order whose coupon no longer fits (its hold
   * lapsed and the use was taken, the email used it up, it expired):
   * CANCELLED; `refunded` when it was approved (the money went back),
   * otherwise the pending payment was cancelled and nothing was charged.
   */
  | { result: "coupon_unavailable"; orderId: string; refunded: boolean }
  /** A payment that was not needed went back: paid after the order was cancelled (`notify`: tell the customer), or a second payment of a paid order. */
  | { result: "refunded"; orderId: string; notify: boolean }
  /** Refunded in Mercado Pago, or charged back: CANCELLED, and `productIds` got their stock back. */
  | { result: "refund_cancelled"; orderId: string; productIds: string[] }
  | { result: "chargeback"; orderId: string; productIds: string[] };

async function lockForPayment(tx: Tx, orderId: string) {
  if (!(await lockOrderRow(tx, orderId))) return null;
  return tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      total: true,
      currency: true,
      paymentProvider: true,
      providerPaymentId: true,
      providerRefundId: true,
      refundRequestedAt: true,
      submittedAt: true,
      items: { select: { productId: true, quantity: true } },
    },
  });
}

/** Records the news about a payment; false when it was already applied. */
async function claimPaymentEvent(tx: Tx, orderId: string, event: MpEvent, source: Source): Promise<boolean> {
  const payment = event.raw;
  const key = `MERCADOPAGO:${event.eventId}`;
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "PaymentEvent" ("id", "key", "orderId", "provider", "paymentId", "status", "statusDetail", "source")
    VALUES (${`pe_${randomUUID()}`}, ${key}, ${orderId}, 'MERCADOPAGO', ${payment.id}, ${payment.status}, ${payment.statusDetail}, ${source})
    ON CONFLICT ("key") DO NOTHING
    RETURNING "id"
  `;
  return rows.length > 0;
}

/** The payment's details on the order (it is the order's payment from now on). */
const paymentFields = (payment: MpPayment) => ({
  providerPaymentId: payment.id,
  paymentStatus: payment.status,
  paymentStatusDetail: payment.statusDetail,
  paymentMethodType: payment.paymentTypeId,
  paymentBrand: payment.paymentMethodId,
  paymentLast4: payment.lastFourDigits,
  // Mercado Pago says 1 for cash and account money too: only a card's means something.
  installments: isCardPaymentType(payment.paymentTypeId) ? payment.installments : null,
  ticketUrl: payment.ticketUrl,
  ticketExpiresAt: payment.expiresAt ? new Date(payment.expiresAt) : null,
});

const cancelled = (reason: CancelReason) => ({ status: "CANCELLED" as const, cancelledAt: new Date(), cancelReason: reason });

/** Whether Mercado Pago charged exactly the order's total, in pesos. */
export const chargedOrderTotal = (payment: MpPayment, order: { total: number; currency: string }) =>
  payment.amount === order.total && payment.currency.toLowerCase() === order.currency.toLowerCase();

async function applyLocked(tx: Tx, mp: MercadoPagoClient, orderId: string, event: MpEvent, source: Source): Promise<ApplyOutcome> {
  const payment = event.raw;
  const order = await lockForPayment(tx, orderId);
  if (!order || order.paymentProvider !== "MERCADOPAGO") return { result: "ignored" };
  if (!(await claimPaymentEvent(tx, order.id, event, source))) return { result: "duplicate", orderId: order.id };

  const update = (data: Prisma.OrderUpdateInput) => tx.order.update({ where: { id: order.id }, data });
  const isCurrent = order.providerPaymentId === null || order.providerPaymentId === payment.id;
  const waiting = order.status === "PENDING" || order.status === "PAYMENT_PENDING";

  const refund = async (key: string) => (await mercadoPagoProvider(mp, null).refund(payment.id, { idempotencyKey: key })).id;

  switch (event.status) {
    case "succeeded": {
      if (waiting) {
        if (!chargedOrderTotal(payment, order) && (order.status === "PENDING" || order.providerPaymentId !== payment.id)) {
          // Not a payment of the order as it is now: a Checkout Pro preference
          // for the total before the customer changed the cart (paid in another
          // tab, or before it was closed). Only that money goes back; the
          // checkout the customer is in goes on.
          const refundId = await refund(strayRefundKey(order.id, payment.id));
          console.warn(
            `[mercadopago] El pago ${payment.id} cobró ${payment.amount} ${payment.currency} y el pedido ${order.id} (${order.status}) es de ${order.total} ${order.currency}: se reembolsó (${refundId}) y el pedido sigue igual.`
          );
          return { result: "refunded", orderId: order.id, notify: false };
        }
        if (!chargedOrderTotal(payment, order)) {
          console.error(
            `[mercadopago] El pago ${payment.id} cobró ${payment.amount} ${payment.currency}; el pedido ${order.id} es de ${order.total} ${order.currency}. Se reembolsa y se cancela.`
          );
          const refundId = await refund(orderRefundKey(order.id));
          await update({ ...paymentFields(payment), ...cancelled("amount_mismatch"), providerRefundId: refundId });
          return { result: "amount_mismatch", orderId: order.id };
        }
        // Paid on Mercado Pago's site (Checkout Pro): its coupon is checked now, before the stock is taken.
        if (!(await secureOrderCoupon(tx, order.id)).ok) {
          console.warn(`[mercadopago] El pago ${payment.id} del pedido ${order.id} usó un cupón que ya no se puede usar: se reembolsa y se cancela.`);
          const refundId = await refund(orderRefundKey(order.id));
          await update({ ...paymentFields(payment), ...cancelled("coupon_unavailable"), providerRefundId: refundId, submittedAt: order.submittedAt ?? new Date() });
          return { result: "coupon_unavailable", orderId: order.id, refunded: true };
        }
        if (await takeStock(tx, order)) {
          const now = new Date();
          await update({ ...paymentFields(payment), status: "PAID", paidAt: now, submittedAt: order.submittedAt ?? now });
          const productIds = order.items.map((item) => item.productId!);
          // The purchased lines leave the account's cart (anything added meanwhile stays).
          if (order.userId) await tx.cartItem.deleteMany({ where: { userId: order.userId, productId: { in: productIds } } });
          return { result: "paid", orderId: order.id, productIds };
        }
        // Someone else got the last units first: the money goes back.
        const refundId = await refund(orderRefundKey(order.id));
        await update({ ...paymentFields(payment), ...cancelled("out_of_stock"), providerRefundId: refundId, submittedAt: order.submittedAt ?? new Date() });
        return { result: "out_of_stock", orderId: order.id };
      }
      if (isCurrent && order.status !== "CANCELLED") {
        // The payment the order already has (a partial refund keeps it approved): nothing changes.
        await update({ paymentStatus: payment.status, paymentStatusDetail: payment.statusDetail });
        return { result: "unchanged", orderId: order.id };
      }
      if (order.status === "CANCELLED" && isCurrent && order.providerRefundId) return { result: "unchanged", orderId: order.id };
      // Money the order does not need: paid after it was cancelled (a ticket paid late), or a second payment of a paid order.
      const late = order.status === "CANCELLED" && isCurrent;
      const refundId = await refund(late ? orderRefundKey(order.id) : strayRefundKey(order.id, payment.id));
      if (late) {
        // The store refunded it (not a refund made in Mercado Pago), and the customer is told the money goes back.
        await update({ ...paymentFields(payment), providerRefundId: refundId, cancelReason: "late_payment_refunded" });
        return { result: "refunded", orderId: order.id, notify: true };
      }
      console.warn(`[mercadopago] Pago ${payment.id} de más del pedido ${order.id} (ya ${order.status}): se reembolsó (${refundId}).`);
      return { result: "refunded", orderId: order.id, notify: false };
    }

    case "pending": {
      if (order.status === "PENDING") {
        // A Checkout Pro payment to be settled later (a ticket, a card under review): its coupon is checked now.
        if (!(await secureOrderCoupon(tx, order.id)).ok) {
          const { outcome, payment: cancelledPayment } = await cancelMercadoPagoPayment(mp, payment.id);
          // Approved meanwhile, or Mercado Pago could not be reached: nothing changes, and the next report decides.
          if (outcome !== "cancelled") throw new Error(`Mercado Pago payment ${payment.id} of order ${order.id} could not be cancelled (its coupon no longer applies)`);
          console.warn(`[mercadopago] El pago ${payment.id} del pedido ${order.id} usó un cupón que ya no se puede usar: se canceló el pago.`);
          await update({ ...paymentFields(cancelledPayment ?? payment), ...cancelled("coupon_unavailable"), submittedAt: order.submittedAt ?? new Date() });
          return { result: "coupon_unavailable", orderId: order.id, refunded: false };
        }
        await update({ ...paymentFields(payment), status: "PAYMENT_PENDING", submittedAt: order.submittedAt ?? new Date() });
        return { result: "pending", orderId: order.id };
      }
      if (isCurrent && order.status === "PAYMENT_PENDING") await update(paymentFields(payment));
      // The order's payment after it settled: a dispute opened (in_mediation) on a paid order. The admin sees it.
      else if (order.providerPaymentId === payment.id) await update({ paymentStatus: payment.status, paymentStatusDetail: payment.statusDetail });
      return { result: "unchanged", orderId: order.id };
    }

    case "failed": {
      if (order.status === "PENDING") {
        // A refused payment is not a purchase: the order leaves "Mis pedidos" until one goes through.
        await update({ ...paymentFields(payment), submittedAt: null });
        return { result: "declined", orderId: order.id };
      }
      if (order.status === "PAYMENT_PENDING" && isCurrent) {
        await update({ ...paymentFields(payment), ...cancelled("payment_rejected") });
        return { result: "cancelled", orderId: order.id, lapsed: true };
      }
      return { result: "unchanged", orderId: order.id };
    }

    case "cancelled": {
      if (waiting && isCurrent) {
        const lapsed = order.status === "PAYMENT_PENDING";
        await update({ ...paymentFields(payment), ...cancelled(payment.statusDetail === "expired" || source === "expire" ? "expired" : "payment_canceled") });
        return { result: "cancelled", orderId: order.id, lapsed };
      }
      return { result: "unchanged", orderId: order.id };
    }

    case "refunded":
    case "chargeback": {
      if (!isCurrent) return { result: "unchanged", orderId: order.id };
      const refundId = event.status === "refunded" ? (order.providerRefundId ?? fullRefundOf(payment)?.id ?? null) : order.providerRefundId;
      const record = { paymentStatus: payment.status, paymentStatusDetail: payment.statusDetail, providerRefundId: refundId };
      if (order.status === "CANCELLED" || order.status === "SHIPPED" || order.status === "DELIVERED") {
        if (order.status !== "CANCELLED") {
          console.warn(`[mercadopago] El pago ${payment.id} quedó ${payment.status}, pero el pedido ${order.id} ya está ${order.status}.`);
        }
        await update(record);
        return { result: "unchanged", orderId: order.id };
      }
      if (order.status === "PAID" && order.refundRequestedAt && event.status === "refunded") {
        // An admin's cancellation asked for this refund: it finishes the order (and records who).
        return { result: "unchanged", orderId: order.id };
      }
      // PAID took the stock: it goes back. A pending one took none.
      const productIds = order.status === "PAID" ? await restock(tx, order.items) : [];
      await update({ ...record, ...cancelled(event.status === "refunded" ? "refunded" : "chargeback") });
      return event.status === "refunded"
        ? { result: "refund_cancelled", orderId: order.id, productIds }
        : { result: "chargeback", orderId: order.id, productIds };
    }

    case "chargeback_reversed": {
      // The store won the dispute: the money is the store's again. Nothing is
      // refunded or restocked; the order keeps its status (a chargeback
      // already cancelled it and returned the stock) and the admin sees the
      // outcome in the payment's status and history.
      if (!isCurrent) return { result: "unchanged", orderId: order.id };
      await update({ paymentStatus: payment.status, paymentStatusDetail: payment.statusDetail });
      console.warn(
        `[mercadopago] Disputa ganada en el pago ${payment.id}: el pedido ${order.id} sigue ${order.status}${order.status === "CANCELLED" ? " (revisa si corresponde enviarlo)" : ""}.`
      );
      return { result: "unchanged", orderId: order.id };
    }
  }
}

/**
 * Applies what Mercado Pago says about a payment (a webhook, the return from
 * Checkout Pro) to the order in its external_reference. Throws (changing
 * nothing) when the work could not be done, e.g. a needed refund failed: the
 * webhook answers 500 and Mercado Pago retries.
 */
export async function applyMercadoPagoPayment(db: PrismaClient, mp: MercadoPagoClient, event: MpEvent, source: Source): Promise<ApplyOutcome> {
  const orderId = event.orderId;
  if (!orderId) return { result: "ignored" };
  return db.$transaction((tx) => applyLocked(tx, mp, orderId, event, source), LOCKED_TX);
}

/**
 * Back from Mercado Pago (or asked to look again): reads the payment from
 * the API and applies it, when it is this order's. `paymentId` is what the
 * return URL said (not trusted: it must be a payment of this order); without
 * it, the order's own payment is read again.
 */
export async function syncMercadoPagoOrder(
  db: PrismaClient,
  mp: MercadoPagoClient,
  orderId: string,
  paymentId: string | null
): Promise<ApplyOutcome> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { paymentProvider: true, providerPaymentId: true, status: true } });
  if (!order || order.paymentProvider !== "MERCADOPAGO") return { result: "ignored" };
  const id = paymentId ?? order.providerPaymentId;
  if (!id) return { result: "unchanged", orderId };
  const payment = await mp.getPayment(id);
  if (!payment || payment.externalReference !== orderId) return { result: "ignored" };
  return applyMercadoPagoPayment(db, mp, mercadoPagoEvent(payment), "return");
}

// ---------------------------------------------------------------------------
// Retiring orders that will not be paid
// ---------------------------------------------------------------------------

/**
 * Cancels a Mercado Pago order that will not be paid (replaced, expired). Its
 * payment, if one is pending, is cancelled with Mercado Pago first; one that
 * went through is applied instead (the order is paid after all). False when
 * the order stays as it is.
 */
/** Told about each payment change a retirement applied (the cron sends the emails that follow). */
export type OnApplied = (outcome: ApplyOutcome) => Promise<void>;

export async function retireMercadoPagoOrder(
  db: PrismaClient,
  mp: MercadoPagoClient,
  order: { id: string; providerPaymentId: string | null },
  reason: CancelReason,
  onApplied?: OnApplied
): Promise<boolean> {
  if (order.providerPaymentId) {
    // The same cancel as the admin's (the provider's). A payment that went
    // through, or ended, is applied instead.
    const { outcome, payment } = await cancelMercadoPagoPayment(mp, order.providerPaymentId);
    // The cancel call failed: its notification (or the next cleanup) settles the order.
    if (!payment && outcome === "in_flight") return false;
    if (payment && mercadoPagoPaymentStage(payment.status)) {
      // Applied like a notification would: settled (it went through after
      // all), ended (an expired ticket, a card rejected after review, whose
      // notification never arrived: the order records why and the customer
      // gets the email), or cancelled just now. A rejection while the order
      // was still at the checkout leaves it PENDING: it is cancelled below.
      const applied = await applyMercadoPagoPayment(db, mp, mercadoPagoEvent(payment), "expire");
      await onApplied?.(applied);
      if (outcome === "in_flight") return false;
      if (applied.result === "cancelled") return true;
    }
  }
  return db.$transaction(async (tx) => {
    if (!(await lockOrderRow(tx, order.id))) return false;
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING", "PAYMENT_PENDING"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    return count > 0;
  }, LOCKED_TX);
}

/** Retires a pending order of either provider (see retireOrder and retireMercadoPagoOrder); false when it stays. */
export async function retireAnyOrder(
  db: PrismaClient,
  payments: OrderPayments,
  order: { id: string; paymentProvider: "STRIPE" | "MERCADOPAGO"; stripePaymentIntentId: string | null; providerPaymentId: string | null },
  reason: CancelReason,
  onApplied?: OnApplied
): Promise<boolean> {
  if (order.paymentProvider === "STRIPE") {
    // Without Stripe here, an order with a PaymentIntent is left for when it is (its cleanup, its webhook).
    if (!payments.stripe) return order.stripePaymentIntentId ? false : retireWithoutPayment(db, order.id, reason);
    return retireOrder(db, payments.stripe, order, reason);
  }
  if (!payments.mercadopago) return order.providerPaymentId ? false : retireWithoutPayment(db, order.id, reason);
  return retireMercadoPagoOrder(db, payments.mercadopago, order, reason, onApplied);
}

async function retireWithoutPayment(db: PrismaClient, orderId: string, reason: CancelReason): Promise<boolean> {
  const { count } = await db.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });
  return count > 0;
}
