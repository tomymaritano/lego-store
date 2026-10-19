import type { NormalizedPaymentEvent, PaymentProvider } from "../provider";
import { verifyMercadoPagoSignature } from "./signature";
import { fullRefundOf, mapMercadoPagoStatus, mercadoPagoPaymentStage } from "./status";
import type { MercadoPagoClient, MpPayment } from "./types";

/*
 * Mercado Pago as a PaymentProvider. Its webhook notifications only say
 * "something happened to payment N": after checking the signature, the
 * payment is read from Mercado Pago's API (the body is never trusted), and
 * that answer is the event. So a late or repeated notification always
 * carries the payment's current status, never an old one.
 */

/**
 * What cancelling a payment left: "cancelled" when it will not be paid (it
 * was cancelled now, it had already ended, or there is no such payment);
 * "in_flight" when it went through (or could not be stopped). `payment` is
 * the payment as it now is, for the order code to apply; null when there is
 * none, or when the cancel call failed and its state is unknown.
 */
export interface MercadoPagoCancelResult {
  outcome: "cancelled" | "in_flight";
  payment: MpPayment | null;
}

/** The one way the store cancels a Mercado Pago payment (the admin's cancellation, the cleanup, a replaced order). */
export async function cancelMercadoPagoPayment(client: MercadoPagoClient, paymentId: string): Promise<MercadoPagoCancelResult> {
  const payment = await client.getPayment(paymentId);
  if (!payment) return { outcome: "cancelled", payment: null };
  const stage = mercadoPagoPaymentStage(payment.status);
  if (stage === "ended") return { outcome: "cancelled", payment };
  if (stage === "settled") return { outcome: "in_flight", payment };
  try {
    return { outcome: "cancelled", payment: await client.cancelPayment(paymentId) };
  } catch (error) {
    // Approved meanwhile (a ticket paid just now): the notification settles the order.
    console.warn(`[mercadopago] No se pudo cancelar el pago ${paymentId}:`, error);
    return { outcome: "in_flight", payment: null };
  }
}

/** A payment as the event the order code applies. */
export function mercadoPagoEvent(payment: MpPayment): NormalizedPaymentEvent<MpPayment> {
  return {
    provider: "MERCADOPAGO",
    eventId: `${payment.id}:${payment.status}:${payment.statusDetail ?? ""}`,
    paymentId: payment.id,
    orderId: payment.externalReference,
    status: mapMercadoPagoStatus(payment.status, payment.statusDetail),
    providerStatus: payment.status,
    providerStatusDetail: payment.statusDetail,
    amount: payment.amount,
    currency: payment.currency,
    raw: payment,
  };
}

interface NotificationBody {
  type?: unknown;
  topic?: unknown;
  action?: unknown;
  data?: { id?: unknown } | null;
}

function parseBody(body: string): NotificationBody | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === "object" ? (parsed as NotificationBody) : null;
  } catch {
    return null;
  }
}

export function mercadoPagoProvider(client: MercadoPagoClient, webhookSecret: string | null): PaymentProvider<MpPayment> {
  return {
    id: "MERCADOPAGO",

    async cancelPayment(paymentId) {
      return (await cancelMercadoPagoPayment(client, paymentId)).outcome;
    },

    refund(paymentId, options) {
      return client.refundPayment(paymentId, options);
    },

    async findRefund(paymentId) {
      // Only a refund of the whole payment: an earlier partial one is not proof the order's refund went through.
      const payment = await client.getPayment(paymentId);
      const refund = payment ? fullRefundOf(payment) : null;
      return refund ? { id: refund.id } : null;
    },

    async parseWebhook({ body, url, headers }) {
      if (!webhookSecret) return null;
      const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
      const valid = verifyMercadoPagoSignature(
        { signature: headers.get("x-signature"), requestId: headers.get("x-request-id"), dataId },
        webhookSecret
      );
      if (!valid) return null;
      const notification = parseBody(body);
      const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? notification?.type ?? notification?.topic;
      // Only payments matter to the store (merchant orders, chargebacks... show up as payment changes too).
      if (type !== "payment" || !dataId || !/^\d{1,20}$/.test(dataId)) return [];
      const payment = await client.getPayment(dataId);
      return payment ? [mercadoPagoEvent(payment)] : [];
    },

    mapStatus: mapMercadoPagoStatus,
  };
}
