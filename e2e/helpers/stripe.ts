import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import Stripe from "stripe";
import { latestOrder } from "./db";

/*
 * Stripe in the e2e suite. The dev server runs with PAYMENTS_MOCK=1 (see
 * playwright.config.ts): payments go through the in-memory mock gateways and
 * nothing reaches Stripe or Mercado Pago. The store's provider is Mercado
 * Pago (the default; helpers/mercadopago.ts); the Stripe specs switch their
 * browser to Stripe with the mock-only cookie (useStripeCheckout), as a store
 * with PAYMENT_PROVIDER=stripe would be. What Stripe would then send, the
 * payment_intent.succeeded webhook, the spec sends itself: signed with the
 * test secret the server verifies (stripe.webhooks.generateTestHeaderString),
 * through the real route.
 */

/** The webhook signing secret of the e2e dev server (test only; never a real one). */
export const E2E_WEBHOOK_SECRET = "whsec_e2e_lego_store_mock_only";

/** Mercado Pago's webhook secret of the e2e dev server (test only). */
export const E2E_MERCADOPAGO_SECRET = "mp_e2e_lego_store_mock_only";

/** Environment of the dev server the e2e suite starts. */
export const E2E_SERVER_ENV = {
  PAYMENTS_MOCK: "1",
  STRIPE_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
  MERCADOPAGO_WEBHOOK_SECRET: E2E_MERCADOPAGO_SECRET,
};

/** The mock-only cookie that picks the provider of this browser's checkout (src/lib/payments/config.ts). */
const MOCK_PROVIDER_COOKIE = "payments-mock-provider";

/** This browser checks out with Stripe (the store's PAYMENT_PROVIDER=stripe). */
export async function useStripeCheckout(context: BrowserContext, baseURL: string | undefined) {
  await context.addCookies([{ name: MOCK_PROVIDER_COOKIE, value: "STRIPE", url: baseURL ?? "http://localhost:3000" }]);
}

/**
 * Sends the signed payment_intent.succeeded event for the newest order of
 * `email` (placed by the spec, its payment confirmed) and returns the
 * webhook's answer.
 */
export async function deliverPaymentSucceeded(request: APIRequestContext, email: string) {
  const order = await latestOrder(email);
  expect(order?.paymentIntentId, `no order with a PaymentIntent for ${email}`).toBeTruthy();
  const payload = JSON.stringify({
    // Unique across workers: the webhook answers "duplicate" to an id it has seen.
    id: `evt_e2e_${randomUUID()}`,
    object: "event",
    type: "payment_intent.succeeded",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: order!.paymentIntentId,
        object: "payment_intent",
        status: "succeeded",
        // What the mock gateway charged: the order's total, which payOrder confirmed under the order's lock.
        amount_received: order!.total * 100,
        currency: "ars",
        metadata: { orderId: order!.id },
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: E2E_WEBHOOK_SECRET });
  const response = await request.post("/api/stripe/webhook", {
    data: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
  expect(response.status()).toBe(200);
  return { order: order!, result: ((await response.json()) as { result: string }).result };
}
