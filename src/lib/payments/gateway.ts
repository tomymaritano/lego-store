/*
 * The payment provider as the order code sees it. Two implementations:
 * - stripeGateway (./stripe.ts): Stripe's API, in test or live mode by key;
 * - mockGateway (./mock.ts): an in-memory stand-in for tests and the e2e
 *   suite (STRIPE_MOCK=1, never in production; see ./config.ts).
 *
 * Amounts are in centavos (Stripe's smallest unit for ARS): pesos x 100.
 * Card data never reaches this server: the browser turns it into a
 * ConfirmationToken with Stripe.js, and the server only reads the token's
 * preview (brand, last 4 digits) and confirms the PaymentIntent with it.
 */

export type IntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

export interface GatewayIntent {
  id: string;
  status: IntentStatus;
  /** Centavos. */
  amount: number;
  /** For stripe.handleNextAction in the browser (3D Secure); never stored. */
  clientSecret: string | null;
}

/** What a ConfirmationToken says about the card ("visa", "4242"). */
export interface CardPreview {
  brand: string;
  last4: string;
}

/** The card was declined or could not be used; `message` is for the customer (Spanish). */
export class PaymentDeclinedError extends Error {
  constructor(
    message: string,
    readonly code: "declined" | "payment_method_invalid"
  ) {
    super(message);
    this.name = "PaymentDeclinedError";
  }
}

/** Intents that can still take a new amount and a new confirmation. */
export const REUSABLE_INTENT_STATUSES: readonly IntentStatus[] = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
];

export interface PaymentGateway {
  createIntent(input: { orderId: string; orderNumber: number; amount: number; email: string; idempotencyKey: string }): Promise<GatewayIntent>;
  retrieveIntent(id: string): Promise<GatewayIntent>;
  updateIntentAmount(id: string, amount: number): Promise<GatewayIntent>;
  /** Throws PaymentDeclinedError when the card is refused or the token cannot be used. */
  confirmIntent(id: string, confirmationTokenId: string, idempotencyKey: string): Promise<GatewayIntent>;
  cancelIntent(id: string): Promise<GatewayIntent>;
  /** Refunds the whole payment, or `amount` centavos of it. */
  refund(intentId: string, idempotencyKey: string, amount?: number): Promise<{ id: string }>;
  /**
   * A refund of the PaymentIntent that went (or is going) through, whoever
   * made it; null when it has none. For finding out what happened after a
   * refund call that got no answer.
   */
  findRefund(intentId: string): Promise<{ id: string } | null>;
  /** The card behind a ConfirmationToken; null when it does not exist, expired or is not a card. */
  readConfirmationToken(id: string): Promise<CardPreview | null>;
}

/** Pesos to centavos. */
export const toCentavos = (pesos: number) => Math.round(pesos * 100);

/** Spanish message for a Stripe decline code (https://docs.stripe.com/declines/codes). */
export function declineMessage(code: string | undefined | null): string {
  switch (code) {
    case "insufficient_funds":
      return "La tarjeta no tiene fondos suficientes. Prueba con otra.";
    case "expired_card":
      return "La tarjeta está vencida. Prueba con otra.";
    case "incorrect_cvc":
    case "invalid_cvc":
      return "El código de seguridad no es correcto.";
    case "incorrect_number":
    case "invalid_number":
      return "El número de tarjeta no es correcto.";
    case "processing_error":
      return "Hubo un error al procesar la tarjeta. Inténtalo de nuevo.";
    case "authentication_required":
    case "payment_intent_authentication_failure":
      return "No se pudo verificar la tarjeta con tu banco. Inténtalo de nuevo o usa otra.";
    default:
      return "Tu banco rechazó el pago. Prueba con otra tarjeta.";
  }
}
