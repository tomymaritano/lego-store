import type { NormalizedPaymentEvent, PaymentProvider } from "../provider";
import { verifyMercadoPagoSignature } from "./signature";
import { mapMercadoPagoStatus } from "./status";
import type { MercadoPagoClient, MpPayment } from "./types";

/*
 * Mercado Pago as a PaymentProvider. Its webhook notifications only say
 * "something happened to payment N": after checking the signature, the
 * payment is read from Mercado Pago's API (the body is never trusted), and
 * that answer is the event. So a late or repeated notification always
 * carries the payment's current status, never an old one.
 */

/** Statuses after which a payment can no longer be cancelled (it went through, or ended). */
const SETTLED = new Set(["approved", "refunded", "charged_back", "in_mediation"]);
const ENDED = new Set(["cancelled", "rejected"]);

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
      const payment = await client.getPayment(paymentId);
      if (!payment || ENDED.has(payment.status)) return "cancelled";
      if (SETTLED.has(payment.status)) return "in_flight";
      try {
        await client.cancelPayment(paymentId);
        return "cancelled";
      } catch (error) {
        // Approved meanwhile (a ticket paid just now): the notification settles the order.
        console.warn(`[mercadopago] No se pudo cancelar el pago ${paymentId}:`, error);
        return "in_flight";
      }
    },

    refund(paymentId, options) {
      return client.refundPayment(paymentId, options);
    },

    async findRefund(paymentId) {
      const payment = await client.getPayment(paymentId);
      return payment?.refunds[0] ?? null;
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
