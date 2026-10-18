import { describe, expect, it, vi } from "vitest";
import { MPBadRequestError, MPNotFoundError, WebhookSignatureValidator } from "mercadopago";
import { chargedOrderTotal } from "@/lib/orders/mercadopago";
import { isCardPaymentType, orderPaymentLabel } from "@/lib/orders/format";
import { mercadoPagoNotificationUrl } from "@/lib/orders/payments";
import {
  checkoutPaymentsConfig,
  checkoutProvider,
  configuredProvider,
  getMercadoPago,
  mercadoPagoClientConfig,
  mercadoPagoMode,
  paymentsUnavailable,
  providerEnvironment,
} from "@/lib/payments/config";
import { mercadoPagoApi, toMpPayment } from "@/lib/payments/mercadopago/api";
import { cancelMercadoPagoPayment, mercadoPagoProvider } from "@/lib/payments/mercadopago/provider";
import { createMockMercadoPagoState, mockMercadoPago, mockMercadoPagoControls } from "@/lib/payments/mercadopago/mock";
import { mpMockToken } from "@/lib/payments/mercadopago/mock-options";
import {
  parseSignatureHeader,
  signMercadoPagoNotification,
  signatureManifest,
  verifyMercadoPagoSignature,
} from "@/lib/payments/mercadopago/signature";
import {
  DEFAULT_REJECTION_MESSAGE,
  fullRefundOf,
  mapMercadoPagoStatus,
  mercadoPagoPaymentStage,
  mercadoPagoStatusLabel,
  pendingMessage,
  rejectionMessage,
} from "@/lib/payments/mercadopago/status";
import { MercadoPagoRequestError, type MpPayment } from "@/lib/payments/mercadopago/types";
import { orderRefundKey } from "@/lib/payments/provider";
import { mapStripeStatus, normalizeStripeEvent } from "@/lib/payments/stripe-provider";
import { makeOrder } from "../helpers/orders";
import { mercadoPagoFormDataSchema, payMercadoPagoOrderSchema } from "@/lib/validations/orders";

/*
 * The Mercado Pago boundary without the network: the webhook signature, how
 * statuses read in the store's words, the SDK adapter (with a fake SDK), the
 * provider's webhook parsing, the configuration, and the inputs. The order
 * flow on top of it is covered against the database in
 * __tests__/integration/mercadopago*.test.ts.
 */

const SECRET = "mp_secret_for_unit_tests";

/** An approved card payment, for the pure helpers. */
const makeMpPayment = (): MpPayment => ({
  id: "1",
  status: "approved",
  statusDetail: "accredited",
  externalReference: "order_1",
  amount: 100,
  currency: "ARS",
  paymentMethodId: "visa",
  paymentTypeId: "credit_card",
  installments: 1,
  lastFourDigits: "3704",
  ticketUrl: null,
  expiresAt: null,
  refunds: [],
});

describe("x-signature", () => {
  it("builds the documented manifest: id (lowercased), request-id, ts, each followed by ';', missing parts left out", () => {
    expect(signatureManifest({ dataId: "123456", requestId: "req-1", ts: "1704908010" })).toBe("id:123456;request-id:req-1;ts:1704908010;");
    expect(signatureManifest({ dataId: "ABC123", requestId: "req-1", ts: "1" })).toBe("id:abc123;request-id:req-1;ts:1;");
    expect(signatureManifest({ dataId: null, requestId: "req-1", ts: "1" })).toBe("request-id:req-1;ts:1;");
    expect(signatureManifest({ dataId: "9", requestId: null, ts: "1" })).toBe("id:9;ts:1;");
  });

  it("accepts what Mercado Pago signs with the secret, and nothing else", () => {
    const header = signMercadoPagoNotification({ dataId: "987654321", requestId: "req-42", ts: "1704908010" }, SECRET);
    const input = { signature: header, requestId: "req-42", dataId: "987654321" };
    expect(verifyMercadoPagoSignature(input, SECRET)).toBe(true);
    // Another payment, another request, another secret, a tampered hash, no header.
    expect(verifyMercadoPagoSignature({ ...input, dataId: "987654322" }, SECRET)).toBe(false);
    expect(verifyMercadoPagoSignature({ ...input, requestId: "req-43" }, SECRET)).toBe(false);
    expect(verifyMercadoPagoSignature(input, "another-secret")).toBe(false);
    expect(verifyMercadoPagoSignature({ ...input, signature: header.replace(/v1=./, "v1=0") }, SECRET)).toBe(false);
    expect(verifyMercadoPagoSignature({ ...input, signature: null }, SECRET)).toBe(false);
    expect(verifyMercadoPagoSignature(input, "")).toBe(false);
  });

  it("agrees with the official SDK's WebhookSignatureValidator", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const header = signMercadoPagoNotification({ dataId: "123", requestId: "abc", ts }, SECRET);
    expect(() => WebhookSignatureValidator.validate({ xSignature: header, xRequestId: "abc", dataId: "123", secret: SECRET })).not.toThrow();
    expect(() => WebhookSignatureValidator.validate({ xSignature: header, xRequestId: "abc", dataId: "124", secret: SECRET })).toThrow();
  });

  it("parses the header leniently (order, spaces, case) but refuses malformed ones", () => {
    expect(parseSignatureHeader(" v1=ABCDEF , ts=123 ")).toEqual({ ts: "123", v1: "abcdef" });
    expect(parseSignatureHeader("ts=abc,v1=ff")).toBeNull();
    expect(parseSignatureHeader("ts=1")).toBeNull();
    expect(parseSignatureHeader("v1=zz,ts=1")).toBeNull();
    expect(parseSignatureHeader("")).toBeNull();
  });

  it("can require the timestamp to be recent", () => {
    const header = signMercadoPagoNotification({ dataId: "1", requestId: "r", ts: "1000" }, SECRET);
    const input = { signature: header, requestId: "r", dataId: "1" };
    expect(verifyMercadoPagoSignature(input, SECRET, { toleranceSeconds: 300, now: 1_200_000 })).toBe(true);
    expect(verifyMercadoPagoSignature(input, SECRET, { toleranceSeconds: 300, now: 2_000_000 })).toBe(false);
  });
});

describe("statuses", () => {
  it("map Mercado Pago's statuses to the store's", () => {
    expect(mapMercadoPagoStatus("approved", "accredited")).toBe("succeeded");
    expect(mapMercadoPagoStatus("approved", "partially_refunded")).toBe("succeeded");
    expect(mapMercadoPagoStatus("pending", "pending_waiting_payment")).toBe("pending");
    expect(mapMercadoPagoStatus("in_process", "pending_contingency")).toBe("pending");
    expect(mapMercadoPagoStatus("authorized")).toBe("pending");
    expect(mapMercadoPagoStatus("in_mediation")).toBe("pending");
    expect(mapMercadoPagoStatus("rejected", "cc_rejected_insufficient_amount")).toBe("failed");
    expect(mapMercadoPagoStatus("cancelled", "expired")).toBe("cancelled");
    expect(mapMercadoPagoStatus("refunded", "refunded")).toBe("refunded");
    expect(mapMercadoPagoStatus("charged_back", "settled")).toBe("chargeback");
    // A chargeback the seller won: the money is back, but it is no new approval (nothing to refund).
    expect(mapMercadoPagoStatus("charged_back", "reimbursed")).toBe("chargeback_reversed");
    expect(mercadoPagoStatusLabel("charged_back", "reimbursed")).toBe("Contracargo: disputa ganada");
    expect(mercadoPagoStatusLabel("charged_back", "settled")).toBe("Contracargo");
  });

  it("and Stripe's, through the same words", () => {
    expect(mapStripeStatus("succeeded")).toBe("succeeded");
    expect(mapStripeStatus("processing")).toBe("pending");
    expect(mapStripeStatus("requires_payment_method")).toBe("failed");
    expect(mapStripeStatus("canceled")).toBe("cancelled");
  });

  it("classify a payment once for every cancel path: settled, ended, cancellable", () => {
    for (const status of ["approved", "refunded", "charged_back", "in_mediation"]) expect(mercadoPagoPaymentStage(status)).toBe("settled");
    for (const status of ["cancelled", "rejected"]) expect(mercadoPagoPaymentStage(status)).toBe("ended");
    for (const status of ["pending", "in_process", "authorized"]) expect(mercadoPagoPaymentStage(status)).toBe("cancellable");
    expect(mercadoPagoPaymentStage("something_new")).toBeNull();
    expect(mercadoPagoPaymentStage("toString")).toBeNull();
  });

  it("only take a refund of the whole payment as the order's refund", () => {
    const base = { ...makeMpPayment(), amount: 1000 };
    expect(fullRefundOf({ ...base, refunds: [] })).toBeNull();
    // A partial refund made in Mercado Pago's panel: still approved.
    const partial = { ...base, statusDetail: "partially_refunded", refunds: [{ id: "r1", amount: 200, status: "approved" }] };
    expect(fullRefundOf(partial)).toBeNull();
    // Then the rest: the latest refund completed it.
    const full = { ...base, status: "refunded", statusDetail: "refunded", refunds: [...partial.refunds, { id: "r2", amount: 800, status: "approved" }] };
    expect(fullRefundOf(full)).toEqual({ id: "r2", amount: 800, status: "approved" });
    expect(fullRefundOf({ ...full, status: "approved" })).toEqual(expect.objectContaining({ id: "r2" }));
    expect(fullRefundOf({ ...base, refunds: [{ id: "r3", amount: 1000, status: "rejected" }] })).toBeNull();
  });

  it("refund an order with one idempotency key, whoever asks", () => {
    expect(orderRefundKey("ord_1")).toBe("order/ord_1/refund");
  });

  it("say why a payment was rejected, in Spanish, with a default for unknown reasons", () => {
    expect(rejectionMessage("cc_rejected_insufficient_amount")).toContain("fondos suficientes");
    expect(rejectionMessage("cc_rejected_bad_filled_security_code")).toContain("código de seguridad");
    expect(rejectionMessage("cc_rejected_call_for_authorize")).toContain("autorices");
    expect(rejectionMessage("something_new")).toBe(DEFAULT_REJECTION_MESSAGE);
    expect(rejectionMessage(null)).toBe(DEFAULT_REJECTION_MESSAGE);
    expect(pendingMessage("ticket", "pending_waiting_payment")).toContain("efectivo");
    expect(pendingMessage("credit_card", "pending_review_manual")).toContain("revisando");
  });

  it("normalizes Stripe's events (the webhook route reads them through the interface)", () => {
    const event = (type: string, object: Record<string, unknown>) => ({ id: "evt_1", type, data: { object } }) as never;
    expect(normalizeStripeEvent(event("payment_intent.succeeded", { id: "pi_1", amount_received: 316_700, currency: "ars", metadata: { orderId: "o1" } }))).toEqual([
      expect.objectContaining({ provider: "STRIPE", paymentId: "pi_1", orderId: "o1", status: "succeeded", amount: 3167 }),
    ]);
    expect(normalizeStripeEvent(event("charge.refunded", { payment_intent: "pi_1", refunded: true }))[0]?.status).toBe("refunded");
    expect(normalizeStripeEvent(event("charge.refunded", { payment_intent: "pi_1", refunded: false }))[0]?.status).toBe("succeeded");
    expect(normalizeStripeEvent(event("customer.created", { id: "cus_1" }))).toEqual([]);
  });
});

describe("amounts", () => {
  const payment = (amount: number, currency = "ARS") => ({ amount, currency }) as MpPayment;

  it("an approved payment settles an order only when it charged exactly its total, in pesos", () => {
    expect(chargedOrderTotal(payment(3167), { total: 3167, currency: "ars" })).toBe(true);
    expect(chargedOrderTotal(payment(3166.99), { total: 3167, currency: "ars" })).toBe(false);
    expect(chargedOrderTotal(payment(316_700), { total: 3167, currency: "ars" })).toBe(false);
    expect(chargedOrderTotal(payment(3167, "BRL"), { total: 3167, currency: "ars" })).toBe(false);
  });

  it("the Brick's amount never reaches the server's input (the order's total is charged)", () => {
    const parsed = mercadoPagoFormDataSchema.parse({
      token: "abcdef1234567890",
      payment_method_id: "visa",
      issuer_id: "310",
      installments: 3,
      transaction_amount: 1,
      payer: { email: "ana@example.com", identification: { type: "DNI", number: "12345678" } },
    });
    expect(parsed).not.toHaveProperty("transaction_amount");
    expect(parsed.issuer_id).toBe(310);
  });

  it("a card payment needs its token; account money takes no form data", () => {
    const attemptId = "5f0c4f3e-6a8f-4d38-8f0e-6a1e2b3c4d5e";
    const valid = (mercadopago: unknown) => payMercadoPagoOrderSchema.safeParse({ mercadopago }).success;
    expect(valid({ attemptId, method: "card", formData: { payment_method_id: "visa" } })).toBe(false);
    expect(valid({ attemptId, method: "card", formData: { payment_method_id: "visa", token: "abcdef1234567890" } })).toBe(true);
    expect(valid({ attemptId, method: "ticket", formData: { payment_method_id: "rapipago" } })).toBe(true);
    expect(valid({ attemptId, method: "ticket" })).toBe(false);
    expect(valid({ attemptId, method: "wallet" })).toBe(true);
    expect(valid({ attemptId: "1", method: "wallet" })).toBe(false);
  });
});

describe("payment labels", () => {
  it("say how an order is paid: card with installments, cash, account money; Stripe's as before", () => {
    const mp = (payment: Partial<ReturnType<typeof makeOrder>["payment"]>, brand: string | null, last4: string | null) =>
      orderPaymentLabel(
        makeOrder({
          paymentBrand: brand,
          paymentLast4: last4,
          payment: { provider: "MERCADOPAGO", methodType: null, installments: null, ticketUrl: null, ticketExpiresAt: null, ...payment },
        })
      );
    expect(orderPaymentLabel(makeOrder())).toBe("Visa •••• 4242");
    expect(mp({ methodType: "credit_card", installments: 3 }, "master", "0604")).toBe("Mastercard •••• 0604 · 3 cuotas");
    expect(mp({ methodType: "credit_card", installments: 1 }, "visa", "3704")).toBe("Visa •••• 3704");
    expect(mp({ methodType: "ticket" }, "rapipago", null)).toBe("Rapipago (efectivo)");
    expect(mp({ methodType: "account_money" }, "account_money", null)).toBe("Dinero en cuenta de Mercado Pago");
    expect(mp({}, null, null)).toBe("A confirmar");
    // Only cards are paid in installments (Mercado Pago says 1 for cash and account money too).
    expect(["credit_card", "debit_card", "prepaid_card"].every(isCardPaymentType)).toBe(true);
    expect([null, "ticket", "account_money", "toString"].some(isCardPaymentType)).toBe(false);
  });
});

describe("the SDK adapter", () => {
  const sdkPayment = {
    id: 123456789,
    status: "pending",
    status_detail: "pending_waiting_payment",
    external_reference: "order_1",
    transaction_amount: 3167,
    currency_id: "ARS",
    payment_method_id: "rapipago",
    payment_type_id: "ticket",
    installments: 1,
    transaction_details: { external_resource_url: "https://www.mercadopago.com.ar/payments/123456789/ticket" },
    date_of_expiration: "2026-10-21T23:59:59.000-04:00",
    refunds: [],
  };

  function fakeSdk() {
    return {
      payment: { create: vi.fn(async () => sdkPayment), get: vi.fn(async () => sdkPayment), cancel: vi.fn(async () => ({ ...sdkPayment, status: "cancelled" })) },
      refund: { create: vi.fn(async () => ({ id: 555 })) },
      preference: {
        create: vi.fn(async () => ({ id: "pref_1", init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_1" })),
        update: vi.fn(async () => ({ id: "pref_1" })),
      },
    };
  }
  const adapter = (sdk: ReturnType<typeof fakeSdk>) => mercadoPagoApi(sdk as unknown as Parameters<typeof mercadoPagoApi>[0]);

  it("reads a payment into the store's shape (ids as strings, the ticket's link and expiry)", () => {
    expect(toMpPayment(sdkPayment as never)).toEqual({
      id: "123456789",
      status: "pending",
      statusDetail: "pending_waiting_payment",
      externalReference: "order_1",
      amount: 3167,
      currency: "ARS",
      paymentMethodId: "rapipago",
      paymentTypeId: "ticket",
      installments: 1,
      lastFourDigits: null,
      ticketUrl: "https://www.mercadopago.com.ar/payments/123456789/ticket",
      expiresAt: "2026-10-21T23:59:59.000-04:00",
      refunds: [],
    });
  });

  it("sends every create with its idempotency key (X-Idempotency-Key)", async () => {
    const sdk = fakeSdk();
    const request = { transaction_amount: 3167, description: "Pedido", payment_method_id: "rapipago", external_reference: "order_1", payer: { email: "a@b.c" } };
    await adapter(sdk).createPayment(request, "order/order_1/mp/attempt");
    expect(sdk.payment.create).toHaveBeenCalledWith({ body: request, requestOptions: { idempotencyKey: "order/order_1/mp/attempt" } });
    await adapter(sdk).refundPayment("123", { idempotencyKey: "order/order_1/refund" });
    expect(sdk.refund.create).toHaveBeenCalledWith({ payment_id: "123", requestOptions: { idempotencyKey: "order/order_1/refund" } });
    await adapter(sdk).refundPayment("123", { idempotencyKey: "k", amount: 100 });
    expect(sdk.refund.create).toHaveBeenLastCalledWith({ payment_id: "123", body: { amount: 100 }, requestOptions: { idempotencyKey: "k" } });
  });

  it("reads refunds with their amount and status, and closes a preference by expiring it now", async () => {
    const refunded = { ...sdkPayment, status: "refunded", refunds: [{ id: 9, amount: 3167, status: "approved" }, { amount: 1 }] };
    expect(toMpPayment(refunded as never).refunds).toEqual([{ id: "9", amount: 3167, status: "approved" }]);
    const sdk = fakeSdk();
    await adapter(sdk).expirePreference("pref_1");
    expect(sdk.preference.update).toHaveBeenCalledWith({
      id: "pref_1",
      updatePreferenceRequest: { expires: true, expiration_date_to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    });
  });

  it("turns a refused request into MercadoPagoRequestError, a missing payment into null", async () => {
    const sdk = fakeSdk();
    sdk.payment.create.mockRejectedValueOnce(new MPBadRequestError({ message: "Invalid card_token_id", status: 400 } as never));
    await expect(adapter(sdk).createPayment({} as never, "k")).rejects.toBeInstanceOf(MercadoPagoRequestError);
    sdk.payment.get.mockRejectedValueOnce(new MPNotFoundError({ message: "not found", status: 404 } as never));
    expect(await adapter(sdk).getPayment("1")).toBeNull();
  });
});

describe("the provider's webhook", () => {
  function setup() {
    const state = createMockMercadoPagoState();
    const client = mockMercadoPago(state);
    return { client, controls: mockMercadoPagoControls(state), provider: mercadoPagoProvider(client, SECRET) };
  }
  const notification = (dataId: string, { secret = SECRET, type = "payment" }: { secret?: string; type?: string } = {}) => {
    const headers = new Headers({ "x-request-id": "req-1", "x-signature": signMercadoPagoNotification({ dataId, requestId: "req-1" }, secret) });
    return {
      body: JSON.stringify({ type, action: `${type}.updated`, data: { id: dataId } }),
      url: new URL(`https://tienda.example/api/webhooks/mercadopago?data.id=${dataId}&type=${type}`),
      headers,
    };
  };

  it("reads the payment from the API: the event carries its current status, whatever the body says", async () => {
    const { client, controls, provider } = setup();
    const payment = await client.createPayment(
      { transaction_amount: 100, description: "x", payment_method_id: "rapipago", external_reference: "order_1", payer: { email: "a@b.c" } },
      "k1"
    );
    controls.setStatus(payment.id, "approved", "accredited");
    const events = await provider.parseWebhook(notification(payment.id));
    expect(events).toEqual([
      expect.objectContaining({ provider: "MERCADOPAGO", paymentId: payment.id, orderId: "order_1", status: "succeeded", providerStatus: "approved" }),
    ]);
  });

  it("refuses a bad signature, ignores other topics and unknown payments", async () => {
    const { provider } = setup();
    expect(await provider.parseWebhook(notification("123", { secret: "wrong" }))).toBeNull();
    expect(await provider.parseWebhook(notification("123", { type: "merchant_order" }))).toEqual([]);
    expect(await provider.parseWebhook(notification("999999"))).toEqual([]);
    expect(await mercadoPagoProvider(setup().client, null).parseWebhook(notification("1"))).toBeNull();
  });

  it("cancels only payments that did not go through", async () => {
    const { client, controls, provider } = setup();
    const ticket = await client.createPayment(
      { transaction_amount: 100, description: "x", payment_method_id: "pagofacil", external_reference: "o", payer: { email: "a@b.c" } },
      "k-ticket"
    );
    expect(await provider.cancelPayment(ticket.id)).toBe("cancelled");
    expect((await client.getPayment(ticket.id))?.status).toBe("cancelled");
    const card = await client.createPayment(
      { transaction_amount: 100, description: "x", payment_method_id: "visa", token: mpMockToken("approved"), external_reference: "o", payer: { email: "a@b.c" } },
      "k-card"
    );
    expect(await provider.cancelPayment(card.id)).toBe("in_flight");
    controls.setStatus(card.id, "approved", "accredited");
    const refund = await provider.refund(card.id, { idempotencyKey: "r1" });
    expect(await provider.refund(card.id, { idempotencyKey: "r1" })).toEqual(refund);
    expect(await provider.findRefund(card.id)).toEqual(refund);
  });

  it("does not take an earlier partial refund for the order's full refund", async () => {
    const { client, controls, provider } = setup();
    const card = await client.createPayment(
      { transaction_amount: 1000, description: "x", payment_method_id: "visa", token: mpMockToken("approved"), external_reference: "o", payer: { email: "a@b.c" } },
      "k-partial"
    );
    controls.setStatus(card.id, "approved", "accredited");
    await provider.refund(card.id, { idempotencyKey: "panel", amount: 300 });
    expect((await client.getPayment(card.id))?.statusDetail).toBe("partially_refunded");
    expect(await provider.findRefund(card.id)).toBeNull();
    const rest = await provider.refund(card.id, { idempotencyKey: "order/o/refund" });
    expect(await client.getPayment(card.id)).toMatchObject({ status: "refunded", refunds: [{ amount: 300 }, { id: rest.id, amount: 700 }] });
    expect(await provider.findRefund(card.id)).toEqual(rest);
  });

  it("cancels through one function that also returns the payment as it now is", async () => {
    const { client, controls } = setup();
    const create = (key: string, method = "rapipago") =>
      client.createPayment({ transaction_amount: 100, description: "x", payment_method_id: method, external_reference: "o", payer: { email: "a@b.c" } }, key);
    const ticket = await create("c1");
    expect(await cancelMercadoPagoPayment(client, ticket.id)).toEqual({ outcome: "cancelled", payment: expect.objectContaining({ id: ticket.id, status: "cancelled" }) });
    // Already ended: nothing to cancel, the payment comes back to be applied.
    expect(await cancelMercadoPagoPayment(client, ticket.id)).toEqual({ outcome: "cancelled", payment: expect.objectContaining({ status: "cancelled" }) });
    const paid = await create("c2");
    controls.setStatus(paid.id, "approved", "accredited");
    expect(await cancelMercadoPagoPayment(client, paid.id)).toEqual({ outcome: "in_flight", payment: expect.objectContaining({ status: "approved" }) });
    expect(await cancelMercadoPagoPayment(client, "999")).toEqual({ outcome: "cancelled", payment: null });
    // The cancel call fails: its state is unknown.
    const pending = await create("c3");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = { ...client, cancelPayment: vi.fn(async () => Promise.reject(new Error("timeout"))) };
    expect(await cancelMercadoPagoPayment(failing, pending.id)).toEqual({ outcome: "in_flight", payment: null });
    warn.mockRestore();
  });
});

describe("configuration", () => {
  const credentials = { MERCADOPAGO_ACCESS_TOKEN: "TEST-123", NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "TEST-pk", MERCADOPAGO_WEBHOOK_SECRET: "s" };

  it("Mercado Pago is the default provider; PAYMENT_PROVIDER=stripe switches new orders", () => {
    expect(configuredProvider({})).toBe("MERCADOPAGO");
    expect(configuredProvider({ PAYMENT_PROVIDER: "MercadoPago" })).toBe("MERCADOPAGO");
    expect(configuredProvider({ PAYMENT_PROVIDER: "stripe" })).toBe("STRIPE");
    vi.spyOn(console, "warn").mockImplementationOnce(() => {});
    expect(configuredProvider({ PAYMENT_PROVIDER: "paypal" })).toBe("MERCADOPAGO");
  });

  it("the test cookie only picks the provider where the mock runs", () => {
    expect(checkoutProvider({ PAYMENTS_MOCK: "1", NODE_ENV: "test" }, "STRIPE")).toBe("STRIPE");
    expect(checkoutProvider({ NODE_ENV: "development", ...credentials }, "STRIPE")).toBe("MERCADOPAGO");
    expect(checkoutProvider({ PAYMENTS_MOCK: "1", NODE_ENV: "production" }, "STRIPE")).toBe("MERCADOPAGO");
    expect(checkoutProvider({ PAYMENTS_MOCK: "1", NODE_ENV: "test" }, "PAYPAL")).toBe("MERCADOPAGO");
  });

  it("needs all three variables, says which are missing in development only, and never mocks in production", () => {
    expect(mercadoPagoMode(credentials)).toBe("mercadopago");
    expect(mercadoPagoClientConfig({ ...credentials, NODE_ENV: "production" })).toEqual({ mode: "mercadopago", publicKey: "TEST-pk", missing: [] });
    expect(mercadoPagoClientConfig({ MERCADOPAGO_ACCESS_TOKEN: "x", NODE_ENV: "development" })).toEqual({
      mode: "unconfigured",
      publicKey: null,
      missing: ["NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET"],
    });
    expect(mercadoPagoClientConfig({ NODE_ENV: "production" }).missing).toEqual([]);
    expect(mercadoPagoMode({ PAYMENTS_MOCK: "1", NODE_ENV: "test" })).toBe("mock");
    expect(mercadoPagoMode({ PAYMENTS_MOCK: "1", NODE_ENV: "production" })).toBe("unconfigured");
    expect(getMercadoPago({})).toBeNull();
  });

  it("tells the checkout which provider and step to show, and the admin how it runs", () => {
    expect(checkoutPaymentsConfig({ NODE_ENV: "development" })).toMatchObject({ provider: "MERCADOPAGO", mode: "unconfigured" });
    expect(checkoutPaymentsConfig({ PAYMENT_PROVIDER: "stripe", NODE_ENV: "development" })).toMatchObject({ provider: "STRIPE", mode: "unconfigured" });
    expect(providerEnvironment("MERCADOPAGO", credentials)).toBe("test");
    expect(providerEnvironment("MERCADOPAGO", { ...credentials, MERCADOPAGO_ACCESS_TOKEN: "APP_USR-1" })).toBe("live");
    expect(providerEnvironment("STRIPE", { PAYMENTS_MOCK: "1", NODE_ENV: "test" })).toBe("mock");
    expect(providerEnvironment("STRIPE", {})).toBe("unconfigured");
  });

  it("says when the checkout cannot take payments, naming the variables only outside production", () => {
    expect(paymentsUnavailable({ NODE_ENV: "development" })).toEqual({
      provider: "MERCADOPAGO",
      missing: ["MERCADOPAGO_ACCESS_TOKEN", "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET"],
    });
    expect(paymentsUnavailable({ NODE_ENV: "production", PAYMENT_PROVIDER: "stripe" })).toEqual({ provider: "STRIPE", missing: [] });
    expect(paymentsUnavailable(credentials)).toBeNull();
    expect(paymentsUnavailable({ PAYMENTS_MOCK: "1", NODE_ENV: "test" })).toBeNull();
  });

  it("only gives Mercado Pago a notification_url it can reach (https, not localhost)", () => {
    expect(mercadoPagoNotificationUrl("http://localhost:3000")).toBeNull();
    expect(mercadoPagoNotificationUrl("https://localhost:3000")).toBeNull();
    expect(mercadoPagoNotificationUrl("https://tienda.example")).toBe("https://tienda.example/api/webhooks/mercadopago?source_news=webhooks");
  });
});
