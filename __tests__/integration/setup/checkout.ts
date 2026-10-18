import Stripe from "stripe";
import { NextRequest } from "next/server";
import { CHECKOUT_COOKIE } from "@/lib/orders/access";

/*
 * Helpers of the checkout integration tests: requests to the Route Handlers
 * as a browser would send them, and Stripe webhook events signed with the
 * test secret (what Stripe does for real, with stripe.webhooks.generateTestHeaderString).
 */

export const TEST_WEBHOOK_SECRET = "whsec_integration_tests_only";

/** Mock payments (STRIPE_MOCK) and the webhook secret, for the code under test. */
export function enableMockPayments() {
  process.env.STRIPE_MOCK = "1";
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
}

export const shipping = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "Ana@Example.com",
  phone: "11 5555 1234",
  address: "Av. Corrientes 1234",
  city: "CABA",
  state: "Ciudad Autónoma de Buenos Aires",
  zipCode: "c1043aaz",
  country: "Argentina",
};

export function jsonRequest(path: string, body: unknown, { cookie, origin = "http://localhost" }: { cookie?: string | null; origin?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", origin };
  if (cookie) headers.cookie = `${CHECKOUT_COOKIE}=${cookie}`;
  return new NextRequest(new URL(path, "http://localhost"), { method: "POST", body: JSON.stringify(body), headers });
}

export function getRequest(path: string, { cookie }: { cookie?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `${CHECKOUT_COOKIE}=${cookie}`;
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

/** The checkout cookie a response set, if any. */
export function cookieOf(response: Response): string | null {
  const header = response.headers.get("set-cookie") ?? "";
  const match = new RegExp(`${CHECKOUT_COOKIE}=([^;]+)`).exec(header);
  return match ? decodeURIComponent(match[1]!) : null;
}

let events = 0;

/**
 * A webhook request for a PaymentIntent event, signed like Stripe signs it.
 * `amountReceived` is what Stripe charged, in centavos (Stripe's
 * amount_received; 0 when left out, as for a payment that did not go through).
 */
export function webhookRequest(
  type: string,
  intent: { id: string; orderId?: string; amountReceived?: number; currency?: string },
  { id = `evt_test_${++events}_${Date.now()}`, secret = TEST_WEBHOOK_SECRET }: { id?: string; secret?: string } = {}
) {
  const payload = JSON.stringify({
    id,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: intent.id,
        object: "payment_intent",
        amount_received: intent.amountReceived ?? 0,
        currency: intent.currency ?? "ars",
        metadata: intent.orderId ? { orderId: intent.orderId } : {},
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new NextRequest(new URL("/api/stripe/webhook", "http://localhost"), {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
}
