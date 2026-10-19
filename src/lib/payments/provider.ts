import type { PaymentProviderId } from "@/lib/orders/types";

/*
 * What the order code needs from whoever takes the money, whatever the
 * provider: Mercado Pago (the default, ./mercadopago) or Stripe (the
 * alternative, ./stripe-provider.ts over ./stripe.ts). Which one a new order
 * uses is PAYMENT_PROVIDER (./config.ts); the order keeps it for its whole
 * life (Order.paymentProvider), so refunds and cancellations of an order
 * always go to the provider that charged it.
 *
 * Collecting the payment is different per provider (Stripe confirms a
 * PaymentIntent with a ConfirmationToken; Mercado Pago creates a payment from
 * the Payment Brick's formData), so each has its own checkout flow on the
 * server (src/lib/orders/checkout.ts, src/lib/orders/mercadopago.ts; the
 * checkout route handlers under src/app/api/checkout pick one with
 * providerFor in src/lib/orders/http.ts) and its own payment step in the
 * browser. After that everything goes through this interface: providers
 * report what happened to a payment as a NormalizedPaymentEvent, and
 * cancelling or refunding is the same call for both.
 *
 * What a payment status does to an order is not a table here: it depends on
 * where the order is (a refund of a shipped order only records it, a late
 * failure of a paid order changes nothing, approved money for a cancelled
 * order goes back...), so each provider's flow owns its transitions, under
 * the order's row lock: applyLocked in src/lib/orders/mercadopago.ts and the
 * handlers in src/lib/orders/webhook.ts.
 */

export type { PaymentProviderId };

/** What happened to a payment, the same words for every provider. */
export type NormalizedPaymentStatus =
  /** The money is in (Stripe succeeded, Mercado Pago approved). */
  | "succeeded"
  /** Taken but not settled: a cash ticket to pay, a card under review. */
  | "pending"
  /** Refused: the customer can try another way (or the order is cancelled, when nobody is there to retry). */
  | "failed"
  /** Will never be paid (cancelled, an expired ticket). */
  | "cancelled"
  /** The whole payment went back to the customer. */
  | "refunded"
  /** The customer disputed it with their bank and the money was taken back. */
  | "chargeback"
  /** A chargeback the store won: the money came back to the store (Mercado Pago's charged_back / reimbursed). */
  | "chargeback_reversed";

/** One piece of news about a payment, from a verified webhook (or the provider's API). */
export interface NormalizedPaymentEvent<Raw = unknown> {
  provider: PaymentProviderId;
  /** Unique per news item: the provider's event id, or payment:status:detail when it has none. */
  eventId: string;
  paymentId: string;
  /** The order it pays, when the provider says (metadata / external_reference). */
  orderId: string | null;
  status: NormalizedPaymentStatus;
  /** The provider's own status and detail ("approved" / "accredited"). */
  providerStatus: string;
  providerStatusDetail: string | null;
  /** What the provider charged, in pesos; null when the news does not say. */
  amount: number | null;
  currency: string | null;
  /** The provider's object, for the code that settles the order. */
  raw: Raw;
}

/** A webhook request as the route received it: the raw body, the URL (query) and the headers. */
export interface WebhookInput {
  body: string;
  url: URL;
  headers: Headers;
}

export interface PaymentProvider<Raw = unknown> {
  readonly id: PaymentProviderId;
  /** Cancels a payment that has not gone through; "in_flight" when it already did (or cannot be stopped). */
  cancelPayment(paymentId: string): Promise<"cancelled" | "in_flight">;
  /**
   * Refunds a payment, all of it or `amount` pesos. The same idempotency key
   * returns the first refund: a retry never refunds twice.
   */
  refund(paymentId: string, options: { idempotencyKey: string; amount?: number }): Promise<{ id: string }>;
  /** A refund the payment already has, whoever made it (to learn the outcome of a call that got no answer). */
  findRefund(paymentId: string): Promise<{ id: string } | null>;
  /**
   * Verifies a webhook's signature and turns it into events (none when it is
   * about something else). Null when the signature does not check out.
   */
  parseWebhook(input: WebhookInput): Promise<NormalizedPaymentEvent<Raw>[] | null>;
  /** The provider's status in our words. */
  mapStatus(providerStatus: string, providerStatusDetail?: string | null): NormalizedPaymentStatus;
}

/**
 * The idempotency key of the refund of an order's payment: one per order,
 * whoever asks (an admin's cancellation, a webhook that finds a line short,
 * either provider), so the same order is never refunded twice.
 */
export const orderRefundKey = (orderId: string) => `order/${orderId}/refund`;

/** The order's payment id with its provider (Stripe's PaymentIntent, Mercado Pago's latest payment). */
export function paymentRefOf(order: {
  paymentProvider: PaymentProviderId;
  stripePaymentIntentId: string | null;
  providerPaymentId: string | null;
}): string | null {
  return order.paymentProvider === "STRIPE" ? order.stripePaymentIntentId : order.providerPaymentId;
}

/** The refund already recorded on the order, with its provider. */
export function refundRefOf(order: { paymentProvider: PaymentProviderId; stripeRefundId: string | null; providerRefundId: string | null }): string | null {
  return order.paymentProvider === "STRIPE" ? order.stripeRefundId : order.providerRefundId;
}

/** The column that records an order's refund, by provider (for updates). */
export const refundColumnOf = (provider: PaymentProviderId) => (provider === "STRIPE" ? "stripeRefundId" : "providerRefundId");

export const PROVIDER_LABELS: Record<PaymentProviderId, string> = { MERCADOPAGO: "Mercado Pago", STRIPE: "Stripe" };
