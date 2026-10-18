import { expect, type APIRequestContext } from "@playwright/test";
import Stripe from "stripe";
import { latestOrder } from "./db";

/*
 * Stripe in the e2e suite. The dev server runs with STRIPE_MOCK=1 (see
 * playwright.config.ts): payments go through the in-memory mock gateway and
 * nothing reaches Stripe. What Stripe would then send, the
 * payment_intent.succeeded webhook, the spec sends itself: signed with the
 * test secret the server verifies (stripe.webhooks.generateTestHeaderString),
 * through the real route.
 */

/** The webhook signing secret of the e2e dev server (test only; never a real one). */
export const E2E_WEBHOOK_SECRET = "whsec_e2e_lego_store_mock_only";

/** Environment of the dev server the e2e suite starts. */
export const E2E_SERVER_ENV = { STRIPE_MOCK: "1", STRIPE_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET };

let delivered = 0;

/**
 * Sends the signed payment_intent.succeeded event for the newest order of
 * `email` (placed by the spec, its payment confirmed) and returns the
 * webhook's answer.
 */
export async function deliverPaymentSucceeded(request: APIRequestContext, email: string) {
  const order = await latestOrder(email);
  expect(order?.paymentIntentId, `no order with a PaymentIntent for ${email}`).toBeTruthy();
  const payload = JSON.stringify({
    id: `evt_e2e_${Date.now()}_${++delivered}`,
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
