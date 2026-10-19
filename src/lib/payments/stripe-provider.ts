import type Stripe from "stripe";
import type { IntentStatus, PaymentGateway } from "./gateway";
import type { NormalizedPaymentEvent, NormalizedPaymentStatus, PaymentProvider } from "./provider";
import { constructWebhookEvent } from "./stripe";

/*
 * Stripe as a PaymentProvider: the same PaymentGateway the Stripe checkout
 * flow uses (./stripe.ts against Stripe's API, ./mock.ts in tests), seen
 * through the provider-neutral interface. Behaviour is the gateway's: this
 * only translates (statuses, webhook events, pesos to centavos).
 */

/** Intents whose payment went through or is going through: they can no longer be cancelled. */
export const STRIPE_PAYMENT_IN_FLIGHT: readonly IntentStatus[] = ["processing", "succeeded", "requires_capture"];

export function mapStripeStatus(status: string): NormalizedPaymentStatus {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "canceled":
      return "cancelled";
    case "requires_payment_method":
      return "failed";
    default:
      // processing, requires_capture, requires_action, requires_confirmation: not settled yet.
      return "pending";
  }
}

interface IntentLike {
  id: string;
  amount_received?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}

interface ChargeLike {
  payment_intent?: string | { id: string } | null;
  refunded?: boolean | null;
  amount_refunded?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}

const INTENT_EVENTS: Record<string, NormalizedPaymentStatus> = {
  "payment_intent.succeeded": "succeeded",
  "payment_intent.payment_failed": "failed",
  "payment_intent.canceled": "cancelled",
};

/** A verified Stripe event in our words; [] for an event the store does not act on. */
export function normalizeStripeEvent(event: Stripe.Event): NormalizedPaymentEvent<Stripe.Event>[] {
  const base = { provider: "STRIPE" as const, eventId: event.id, providerStatusDetail: null, raw: event };
  const status = INTENT_EVENTS[event.type];
  if (status) {
    const intent = event.data.object as unknown as IntentLike;
    if (typeof intent?.id !== "string") return [];
    return [
      {
        ...base,
        paymentId: intent.id,
        orderId: intent.metadata?.orderId ?? null,
        status,
        providerStatus: event.type,
        amount: typeof intent.amount_received === "number" ? intent.amount_received / 100 : null,
        currency: intent.currency ?? null,
      },
    ];
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object as unknown as ChargeLike;
    const intent = charge?.payment_intent;
    const paymentId = typeof intent === "string" ? intent : typeof intent?.id === "string" ? intent.id : null;
    if (!paymentId) return [];
    return [
      {
        ...base,
        paymentId,
        orderId: charge.metadata?.orderId ?? null,
        // A partial refund leaves the payment standing.
        status: charge.refunded === true ? "refunded" : "succeeded",
        providerStatus: event.type,
        amount: typeof charge.amount_refunded === "number" ? charge.amount_refunded / 100 : null,
        currency: charge.currency ?? null,
      },
    ];
  }
  return [];
}

export function stripeProvider(gateway: PaymentGateway, webhookSecret: string | null): PaymentProvider<Stripe.Event> {
  return {
    id: "STRIPE",

    async cancelPayment(intentId) {
      const intent = await gateway.retrieveIntent(intentId);
      if (STRIPE_PAYMENT_IN_FLIGHT.includes(intent.status)) return "in_flight";
      if (intent.status === "canceled") return "cancelled";
      try {
        await gateway.cancelIntent(intentId);
        return "cancelled";
      } catch (error) {
        // It moved on meanwhile (a payment went through): the webhook settles the order.
        console.warn(`[stripe] No se pudo cancelar el pago ${intentId}:`, error);
        return "in_flight";
      }
    },

    refund(intentId, { idempotencyKey, amount }) {
      return gateway.refund(intentId, idempotencyKey, amount === undefined ? undefined : Math.round(amount * 100));
    },

    findRefund(intentId) {
      return gateway.findRefund(intentId);
    },

    async parseWebhook({ body, headers }) {
      const signature = headers.get("stripe-signature");
      if (!webhookSecret || !signature) return null;
      try {
        return normalizeStripeEvent(constructWebhookEvent(body, signature, webhookSecret));
      } catch (error) {
        console.warn("[stripe] Webhook con firma inválida:", error instanceof Error ? error.message : error);
        return null;
      }
    },

    mapStatus: mapStripeStatus,
  };
}
