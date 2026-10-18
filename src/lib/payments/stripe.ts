import Stripe from "stripe";
import {
  PaymentDeclinedError,
  declineMessage,
  type CardPreview,
  type GatewayIntent,
  type IntentStatus,
  type PaymentGateway,
} from "./gateway";

/*
 * PaymentGateway on Stripe's API. The SDK client is passed in (the app makes
 * one from STRIPE_SECRET_KEY in ./config.ts; unit tests pass a fake with the
 * same methods), so everything Stripe sees is decided here:
 *
 * - PaymentIntents are in ARS, card only (the Payment Element in the browser
 *   is created with the same currency and method, see PaymentStep), with the
 *   order id in the metadata (the webhook finds the order by it) and an
 *   idempotency key per order, so a retried request never makes a second one.
 * - Confirmation happens on the server with the ConfirmationToken the
 *   browser made (use_stripe_sdk: the browser finishes 3D Secure with
 *   stripe.handleNextAction).
 */

type StripeClient = Pick<Stripe, "paymentIntents" | "refunds" | "confirmationTokens">;

interface RawIntent {
  id: string;
  status: string;
  amount: number;
  client_secret?: string | null;
}

const toIntent = (intent: RawIntent): GatewayIntent => ({
  id: intent.id,
  status: intent.status as IntentStatus,
  amount: intent.amount,
  clientSecret: intent.client_secret ?? null,
});

interface StripeLikeError {
  type?: string;
  code?: string;
  decline_code?: string;
  statusCode?: number;
}

const asStripeError = (error: unknown): StripeLikeError | null =>
  typeof error === "object" && error !== null && "type" in error ? (error as StripeLikeError) : null;

/** Codes that mean "this ConfirmationToken cannot be used": the browser has to make a new one. */
const UNUSABLE_TOKEN_CODES = new Set(["resource_missing", "token_already_used", "confirmation_token_expired", "expired_card"]);

export function stripeGateway(stripe: StripeClient): PaymentGateway {
  return {
    async createIntent({ orderId, orderNumber, amount, email, idempotencyKey }) {
      const intent = await stripe.paymentIntents.create(
        {
          amount,
          currency: "ars",
          allowed_payment_method_types: ["card"],
          description: `Pedido LEGO Store #${orderNumber}`,
          receipt_email: email,
          metadata: { orderId, orderNumber: String(orderNumber) },
        },
        { idempotencyKey }
      );
      return toIntent(intent);
    },

    async retrieveIntent(id) {
      return toIntent(await stripe.paymentIntents.retrieve(id));
    },

    async updateIntentAmount(id, amount) {
      return toIntent(await stripe.paymentIntents.update(id, { amount }));
    },

    async confirmIntent(id, confirmationTokenId, idempotencyKey) {
      try {
        const intent = await stripe.paymentIntents.confirm(
          id,
          { confirmation_token: confirmationTokenId, use_stripe_sdk: true },
          { idempotencyKey }
        );
        return toIntent(intent);
      } catch (error) {
        const stripeError = asStripeError(error);
        if (stripeError?.type === "StripeCardError") {
          throw new PaymentDeclinedError(declineMessage(stripeError.decline_code ?? stripeError.code), "declined");
        }
        if (stripeError?.type === "StripeInvalidRequestError" && UNUSABLE_TOKEN_CODES.has(stripeError.code ?? "")) {
          throw new PaymentDeclinedError("Vuelve a ingresar los datos de la tarjeta.", "payment_method_invalid");
        }
        throw error;
      }
    },

    async cancelIntent(id) {
      return toIntent(await stripe.paymentIntents.cancel(id));
    },

    async refund(intentId, idempotencyKey, amount) {
      const refund = await stripe.refunds.create(
        amount === undefined ? { payment_intent: intentId } : { payment_intent: intentId, amount },
        { idempotencyKey }
      );
      return { id: refund.id };
    },

    async findRefund(intentId) {
      const refunds = await stripe.refunds.list({ payment_intent: intentId, limit: 10 });
      // "failed" and "canceled" refunds gave nothing back.
      const refund = refunds.data.find((item) => item.status !== "failed" && item.status !== "canceled");
      return refund ? { id: refund.id } : null;
    },

    async readConfirmationToken(id): Promise<CardPreview | null> {
      try {
        const token = await stripe.confirmationTokens.retrieve(id);
        const card = token.payment_method_preview?.card;
        return card ? { brand: card.brand, last4: card.last4 } : null;
      } catch (error) {
        if (asStripeError(error)?.type === "StripeInvalidRequestError") return null;
        throw error;
      }
    },
  };
}

/** A Stripe API client for a secret key. */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { appInfo: { name: "lego-store" }, maxNetworkRetries: 2 });
}

/**
 * Verifies a webhook's Stripe-Signature header against the endpoint's secret
 * and parses the event. Throws when the signature or the timestamp do not
 * check out. Needs no API key.
 */
export function constructWebhookEvent(payload: string, signature: string, secret: string): Stripe.Event {
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}
