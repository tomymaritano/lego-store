import { describe, expect, it, vi } from "vitest";
import { getPaymentGateway, isMockAllowed, mockPaymentsWarning, paymentsClientConfig, paymentsMode } from "@/lib/payments/config";
import { PaymentDeclinedError, toCentavos } from "@/lib/payments/gateway";
import { stripeGateway } from "@/lib/payments/stripe";
import { SETTLED_TOKEN_ACCESS_MS, canAccessOrder, hashAccessToken, parseCheckoutCookie, serializeCheckoutCookie, tokenMatches } from "@/lib/orders/access";

/*
 * The Stripe boundary with the SDK mocked: what our gateway sends to Stripe
 * and how it reads Stripe's answers and errors. (The order flow on top of it
 * is covered against the database in __tests__/integration.)
 */

function fakeStripe() {
  const intent = { id: "pi_123", status: "requires_payment_method", amount: 316_700, client_secret: "pi_123_secret_abc" };
  return {
    paymentIntents: {
      create: vi.fn(async () => intent),
      retrieve: vi.fn(async () => intent),
      update: vi.fn(async () => intent),
      confirm: vi.fn(async () => ({ ...intent, status: "succeeded" })),
      cancel: vi.fn(async () => ({ ...intent, status: "canceled" })),
    },
    refunds: {
      create: vi.fn(async () => ({ id: "re_123" })),
      list: vi.fn(async (): Promise<{ data: { id: string; status: string }[] }> => ({ data: [] })),
    },
    confirmationTokens: {
      retrieve: vi.fn(async () => ({ id: "ctoken_123", payment_method_preview: { type: "card", card: { brand: "mastercard", last4: "4444" } } })),
    },
  };
}

const gatewayOn = (stripe: ReturnType<typeof fakeStripe>) => stripeGateway(stripe as unknown as Parameters<typeof stripeGateway>[0]);

const stripeError = (type: string, fields: Record<string, string> = {}) => Object.assign(new Error("stripe"), { type, ...fields });

describe("stripeGateway", () => {
  it("creates card-only PaymentIntents in ARS centavos, with the order in the metadata and an idempotency key", async () => {
    const stripe = fakeStripe();
    const intent = await gatewayOn(stripe).createIntent({
      orderId: "order_1",
      orderNumber: 1001,
      amount: toCentavos(3167),
      email: "ana@example.com",
      idempotencyKey: "order/order_1/intent",
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 316_700,
        currency: "ars",
        allowed_payment_method_types: ["card"],
        description: "Pedido LEGO Store #1001",
        receipt_email: "ana@example.com",
        metadata: { orderId: "order_1", orderNumber: "1001" },
      },
      { idempotencyKey: "order/order_1/intent" }
    );
    expect(intent).toEqual({ id: "pi_123", status: "requires_payment_method", amount: 316_700, clientSecret: "pi_123_secret_abc" });
  });

  it("confirms on the server with the ConfirmationToken, letting Stripe.js finish 3D Secure", async () => {
    const stripe = fakeStripe();
    const intent = await gatewayOn(stripe).confirmIntent("pi_123", "ctoken_123", "order/1/confirm/ctoken_123");
    expect(stripe.paymentIntents.confirm).toHaveBeenCalledWith(
      "pi_123",
      { confirmation_token: "ctoken_123", use_stripe_sdk: true },
      { idempotencyKey: "order/1/confirm/ctoken_123" }
    );
    expect(intent.status).toBe("succeeded");
  });

  it("turns card errors into Spanish decline messages and a spent token into 'enter the card again'", async () => {
    const stripe = fakeStripe();
    const gateway = gatewayOn(stripe);
    stripe.paymentIntents.confirm.mockRejectedValueOnce(stripeError("StripeCardError", { code: "card_declined", decline_code: "insufficient_funds" }));
    await expect(gateway.confirmIntent("pi_123", "ctoken_1", "k1")).rejects.toMatchObject({
      name: "PaymentDeclinedError",
      code: "declined",
      message: expect.stringContaining("fondos suficientes"),
    });
    stripe.paymentIntents.confirm.mockRejectedValueOnce(stripeError("StripeInvalidRequestError", { code: "token_already_used" }));
    await expect(gateway.confirmIntent("pi_123", "ctoken_1", "k2")).rejects.toBeInstanceOf(PaymentDeclinedError);
    stripe.paymentIntents.confirm.mockRejectedValueOnce(stripeError("StripeAPIError"));
    await expect(gateway.confirmIntent("pi_123", "ctoken_1", "k3")).rejects.not.toBeInstanceOf(PaymentDeclinedError);
  });

  it("reads only the brand and last 4 digits from a ConfirmationToken; a missing one is null", async () => {
    const stripe = fakeStripe();
    const gateway = gatewayOn(stripe);
    expect(await gateway.readConfirmationToken("ctoken_123")).toEqual({ brand: "mastercard", last4: "4444" });
    stripe.confirmationTokens.retrieve.mockRejectedValueOnce(stripeError("StripeInvalidRequestError", { code: "resource_missing" }));
    expect(await gateway.readConfirmationToken("ctoken_nope")).toBeNull();
  });

  it("refunds with an idempotency key", async () => {
    const stripe = fakeStripe();
    expect(await gatewayOn(stripe).refund("pi_123", "order/1/refund")).toEqual({ id: "re_123" });
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_123" }, { idempotencyKey: "order/1/refund" });
  });

  it("finds a PaymentIntent's refund that went through, skipping failed and canceled ones", async () => {
    const stripe = fakeStripe();
    const gateway = gatewayOn(stripe);
    expect(await gateway.findRefund("pi_123")).toBeNull();
    expect(stripe.refunds.list).toHaveBeenCalledWith({ payment_intent: "pi_123", limit: 10 });
    stripe.refunds.list.mockResolvedValueOnce({ data: [{ id: "re_failed", status: "failed" }, { id: "re_ok", status: "pending" }] });
    expect(await gateway.findRefund("pi_123")).toEqual({ id: "re_ok" });
    stripe.refunds.list.mockResolvedValueOnce({ data: [{ id: "re_canceled", status: "canceled" }] });
    expect(await gateway.findRefund("pi_123")).toBeNull();
  });
});

describe("payments configuration", () => {
  const keys = { STRIPE_SECRET_KEY: "sk_test_1", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_1", STRIPE_WEBHOOK_SECRET: "whsec_1" };

  it("uses Stripe with all three keys; says what is missing otherwise (never in production)", () => {
    expect(paymentsMode(keys)).toBe("stripe");
    expect(paymentsClientConfig({ ...keys, NODE_ENV: "production" })).toEqual({ mode: "stripe", publishableKey: "pk_test_1", missing: [] });
    expect(paymentsClientConfig({ STRIPE_SECRET_KEY: "sk_test_1", NODE_ENV: "development" })).toEqual({
      mode: "unconfigured",
      publishableKey: null,
      missing: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
    });
    expect(paymentsClientConfig({ NODE_ENV: "production" }).missing).toEqual([]);
    expect(getPaymentGateway({})).toBeNull();
  });

  it("the mock only exists outside production, with the explicit flag", () => {
    expect(paymentsMode({ STRIPE_MOCK: "1", NODE_ENV: "test" })).toBe("mock");
    expect(paymentsMode({ STRIPE_MOCK: "1", NODE_ENV: "development", ...keys })).toBe("mock");
    expect(paymentsMode({ STRIPE_MOCK: "1", NODE_ENV: "production" })).toBe("unconfigured");
    expect(paymentsMode({ STRIPE_MOCK: "1", NODE_ENV: "production", ...keys })).toBe("stripe");
    expect(paymentsMode({ STRIPE_MOCK: "true", NODE_ENV: "development" })).toBe("unconfigured");
  });

  it("a production build never selects the mock, whatever NODE_ENV it is started with", () => {
    expect(isMockAllowed({ STRIPE_MOCK: "1", NODE_ENV: "test" }, false)).toBe(true);
    expect(isMockAllowed({ STRIPE_MOCK: "1", NODE_ENV: "test" }, true)).toBe(false);
    expect(isMockAllowed({ STRIPE_MOCK: "1", NODE_ENV: "development" }, true)).toBe(false);
  });

  it("warns at startup only when the mock takes the payments", () => {
    expect(mockPaymentsWarning({ STRIPE_MOCK: "1", NODE_ENV: "development" })).toContain("no se cobra nada");
    expect(mockPaymentsWarning({ NODE_ENV: "development" })).toBeNull();
    expect(mockPaymentsWarning({ STRIPE_MOCK: "1", NODE_ENV: "production" })).toBeNull();
  });
});

describe("checkout access", () => {
  const token = "a".repeat(43);

  it("round-trips the cookie and rejects malformed ones", () => {
    expect(parseCheckoutCookie(serializeCheckoutCookie({ orderId: "order_1", token }))).toEqual({ orderId: "order_1", token });
    expect(parseCheckoutCookie("order_1.short")).toBeNull();
    expect(parseCheckoutCookie("../etc.passwd")).toBeNull();
    expect(parseCheckoutCookie(undefined)).toBeNull();
  });

  it("an account's order opens with that account's session only; a guest's with its token", () => {
    const pending = { status: "PENDING", paidAt: null, cancelledAt: null };
    const order = { id: "order_1", userId: "ana", checkoutTokenHash: hashAccessToken(token), ...pending };
    expect(tokenMatches(token, order.checkoutTokenHash)).toBe(true);
    expect(canAccessOrder(order, { userId: "ana", access: null })).toBe(true);
    // Signed out (or someone else signed in) on the same browser: the cookie no longer opens it.
    expect(canAccessOrder(order, { userId: null, access: { orderId: "order_1", token } })).toBe(false);
    expect(canAccessOrder(order, { userId: "bruno", access: { orderId: "order_1", token } })).toBe(false);

    const guest = { ...order, userId: null };
    expect(canAccessOrder(guest, { userId: null, access: { orderId: "order_1", token } })).toBe(true);
    expect(canAccessOrder(guest, { userId: "bruno", access: { orderId: "order_1", token } })).toBe(true);
    expect(canAccessOrder(guest, { userId: null, access: { orderId: "order_2", token } })).toBe(false);
    expect(canAccessOrder(guest, { userId: null, access: { orderId: "order_1", token: "b".repeat(43) } })).toBe(false);
    expect(canAccessOrder(guest, { userId: null, access: null })).toBe(false);
  });

  it("a guest's token outlives its settled order only briefly", () => {
    const paidAt = new Date("2026-10-17T12:00:00Z");
    const guest = { id: "order_1", userId: null, checkoutTokenHash: hashAccessToken(token), status: "PAID", paidAt, cancelledAt: null };
    const browser = { userId: null, access: { orderId: "order_1", token } };
    expect(canAccessOrder(guest, browser, new Date(paidAt.getTime() + SETTLED_TOKEN_ACCESS_MS - 1000))).toBe(true);
    expect(canAccessOrder(guest, browser, new Date(paidAt.getTime() + SETTLED_TOKEN_ACCESS_MS + 1000))).toBe(false);
    expect(canAccessOrder({ ...guest, status: "SHIPPED" }, browser, new Date(paidAt.getTime() + 2 * SETTLED_TOKEN_ACCESS_MS))).toBe(false);
  });
});
