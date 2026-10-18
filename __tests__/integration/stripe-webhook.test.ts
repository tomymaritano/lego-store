import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidateTag } from "next/cache";
import { payOrder, prepareOrder } from "@/lib/orders/checkout";
import { getPaymentGateway } from "@/lib/payments/config";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { prepareOrderSchema } from "@/lib/validations/orders";
import { resetAndSeed, testDb } from "./setup/db";
import { shipping, enableMockPayments, webhookRequest } from "./setup/checkout";

/*
 * POST /api/stripe/webhook against the test database, with events signed
 * like Stripe signs them (generateTestHeaderString and the test secret):
 * signature checks, PAID with the stock taken atomically, the race for the
 * last unit (one refund), idempotent replays, failed and cancelled payments,
 * the confirmation email (console fallback) and the cart cleanup.
 */

enableMockPayments();
const { POST: webhook } = await import("@/app/api/stripe/webhook/route");

let gateway: PaymentGateway;
let ana: { id: string };

const stockOf = async (id: string) => (await testDb.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock;
const setStock = (id: string, stock: number) => testDb.product.update({ where: { id }, data: { stock } });

/** A PENDING order whose payment Stripe accepted (what the browser leaves behind after "Realizar pedido"). */
async function paidOrder(lines: { productId: string; quantity: number }[], userId: string | null = null) {
  const outcome = await prepareOrder(
    testDb,
    gateway,
    prepareOrderSchema.parse({ shipping, lines, confirmationTokenId: "ctoken_mock_visa" }),
    { userId, access: null }
  );
  if (!outcome.ok) throw new Error(outcome.code);
  const paid = await payOrder(testDb, gateway, outcome.order.id, "ctoken_mock_visa", { userId, access: outcome.access });
  if (!paid.ok) throw new Error(paid.code);
  const row = await testDb.order.findUniqueOrThrow({ where: { id: outcome.order.id } });
  return { id: row.id, intentId: row.stripePaymentIntentId! };
}

/** payment_intent.succeeded as Stripe sends it: with the amount the (mock) gateway charged. */
const succeeded = async (order: { id: string; intentId: string }, options?: { id?: string }) => {
  const intent = await gateway.retrieveIntent(order.intentId);
  return webhook(
    webhookRequest("payment_intent.succeeded", { id: order.intentId, orderId: order.id, amountReceived: intent.amount }, options)
  );
};

let emails: { mock: { calls: unknown[][] }; mockRestore: () => void };

beforeAll(async () => {
  await resetAndSeed();
  gateway = getPaymentGateway()!;
  ana = await testDb.user.create({ data: { email: "ana@webhook.test", name: "Ana" } });
});

beforeEach(async () => {
  emails = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.mocked(revalidateTag).mockClear();
  await Promise.all([setStock("5", 8), setStock("7", 40), setStock("15", 3)]);
});

afterEach(() => {
  emails.mockRestore();
});

const sentEmails = () => emails.mock.calls.map((call) => String(call[0])).filter((text) => text.startsWith("\n[email]"));

describe("POST /api/stripe/webhook", () => {
  it("rejects events without a valid signature", async () => {
    const order = await paidOrder([{ productId: "7", quantity: 1 }]);
    const forged = await webhook(
      webhookRequest("payment_intent.succeeded", { id: order.intentId, orderId: order.id }, { secret: "whsec_someone_else" })
    );
    expect(forged.status).toBe(400);
    const request = webhookRequest("payment_intent.succeeded", { id: order.intentId });
    request.headers.delete("stripe-signature");
    expect((await webhook(request)).status).toBe(400);
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await stockOf("7")).toBe(40);
  });

  it("payment_intent.succeeded marks the order PAID, takes the stock, empties those cart lines, refreshes the cache and emails the customer", async () => {
    await testDb.cartItem.createMany({
      data: [
        { userId: ana.id, productId: "7", quantity: 2 },
        { userId: ana.id, productId: "5", quantity: 1 },
        { userId: ana.id, productId: "11", quantity: 1 },
      ],
    });
    const order = await paidOrder(
      [
        { productId: "7", quantity: 2 },
        { productId: "5", quantity: 1 },
      ],
      ana.id
    );
    const response = await succeeded(order);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: "paid" });

    const row = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row).toMatchObject({ status: "PAID", stripeRefundId: null });
    expect(row.paidAt).not.toBeNull();
    expect(await stockOf("7")).toBe(38);
    expect(await stockOf("5")).toBe(7);
    // Only the bought lines leave the account's cart.
    expect((await testDb.cartItem.findMany({ where: { userId: ana.id } })).map((line) => line.productId)).toEqual(["11"]);
    expect(revalidateTag).toHaveBeenCalledWith("product:7", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("product:5", { expire: 0 });

    const [email] = sentEmails();
    expect(email).toContain("Para: ana@example.com");
    expect(email).toMatch(/Asunto: Confirmamos tu pedido LEGO-\d{6}/);
    expect(email).toContain("Batmobile × 2");
  });

  it("is idempotent: the same event twice takes the stock once; another event for a paid order changes nothing", async () => {
    const order = await paidOrder([{ productId: "7", quantity: 1 }]);
    const id = `evt_replay_${Date.now()}`;
    expect(await (await succeeded(order, { id })).json()).toMatchObject({ result: "paid" });
    expect(await (await succeeded(order, { id })).json()).toMatchObject({ result: "duplicate" });
    expect(await (await succeeded(order)).json()).toMatchObject({ result: "unchanged" });
    expect(await stockOf("7")).toBe(39);
    expect(sentEmails()).toHaveLength(1);
    expect(await testDb.processedStripeEvent.count({ where: { id } })).toBe(1);
  });

  it("two payments for the last unit: one order is PAID, the other is refunded and CANCELLED", async () => {
    await setStock("15", 1);
    const first = await paidOrder([{ productId: "15", quantity: 1 }]);
    const second = await paidOrder([{ productId: "15", quantity: 1 }]);
    const refund = vi.spyOn(gateway, "refund");

    const results = await Promise.all([succeeded(first), succeeded(second)]);
    expect(results.map((response) => response.status)).toEqual([200, 200]);
    const outcomes = (await Promise.all(results.map((response) => response.json()))).map((body) => body.result).sort();
    expect(outcomes).toEqual(["out_of_stock", "paid"]);

    const rows = await testDb.order.findMany({ where: { id: { in: [first.id, second.id] } } });
    const paid = rows.filter((row) => row.status === "PAID");
    const cancelled = rows.filter((row) => row.status === "CANCELLED");
    expect(paid).toHaveLength(1);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({ cancelReason: "out_of_stock", stripeRefundId: expect.stringMatching(/^re_mock_/) });
    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund).toHaveBeenCalledWith(cancelled[0]!.stripePaymentIntentId, `order/${cancelled[0]!.id}/refund`);
    expect(await stockOf("15")).toBe(0);
    refund.mockRestore();
  });

  it("a failed refund rolls everything back and answers 500, so Stripe retries", async () => {
    await setStock("15", 0);
    await setStock("15", 1);
    const order = await paidOrder([{ productId: "15", quantity: 1 }]);
    await setStock("15", 0);
    const refund = vi.spyOn(gateway, "refund").mockRejectedValueOnce(new Error("Stripe is down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const id = `evt_retry_${Date.now()}`;

    expect((await succeeded(order, { id })).status).toBe(500);
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await testDb.processedStripeEvent.count({ where: { id } })).toBe(0);

    expect(await (await succeeded(order, { id })).json()).toMatchObject({ result: "out_of_stock" });
    expect(refund).toHaveBeenCalledTimes(2);
    refund.mockRestore();
  });

  it("a charge that is not the order's total is refunded and the order CANCELLED, taking no stock", async () => {
    const order = await paidOrder([{ productId: "7", quantity: 1 }]);
    const intent = await gateway.retrieveIntent(order.intentId);
    const charged = (amountReceived: number, currency = "ars") =>
      webhook(webhookRequest("payment_intent.succeeded", { id: order.intentId, orderId: order.id, amountReceived, currency }));

    // Lines worth more than what was charged (the drift the checkout's lock prevents) never ship.
    expect(await (await charged(intent.amount - 100)).json()).toMatchObject({ result: "amount_mismatch" });
    const row = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row).toMatchObject({ status: "CANCELLED", cancelReason: "amount_mismatch", paidAt: null });
    expect(row.stripeRefundId).toMatch(/^re_mock_/);
    expect(await stockOf("7")).toBe(40);
    expect(sentEmails()).toHaveLength(0);

    // The right amount in another currency is no better.
    const other = await paidOrder([{ productId: "7", quantity: 1 }]);
    const usd = await webhook(
      webhookRequest("payment_intent.succeeded", { id: other.intentId, orderId: other.id, amountReceived: intent.amount, currency: "usd" })
    );
    expect(await usd.json()).toMatchObject({ result: "amount_mismatch" });
    expect(await stockOf("7")).toBe(40);
  });

  it("payment_failed keeps the order PENDING (out of Mis pedidos); canceled cancels it", async () => {
    const order = await paidOrder([{ productId: "7", quantity: 1 }]);
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).submittedAt).not.toBeNull();
    const failed = await webhook(webhookRequest("payment_intent.payment_failed", { id: order.intentId, orderId: order.id }));
    expect(await failed.json()).toMatchObject({ result: "unchanged" });
    expect(await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: "PENDING", submittedAt: null });

    const canceled = await webhook(webhookRequest("payment_intent.canceled", { id: order.intentId, orderId: order.id }));
    expect(await canceled.json()).toMatchObject({ result: "cancelled" });
    expect(await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: "CANCELLED",
      cancelReason: "payment_canceled",
    });
    expect(await stockOf("7")).toBe(40);
  });

  it("a payment that went through after its order was cancelled is refunded", async () => {
    const order = await paidOrder([{ productId: "7", quantity: 1 }]);
    await testDb.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelReason: "expired", cancelledAt: new Date() } });
    expect(await (await succeeded(order)).json()).toMatchObject({ result: "refunded" });
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).stripeRefundId).toMatch(/^re_mock_/);
    expect(await stockOf("7")).toBe(40);
  });

  it("ignores events it does not handle and intents of no order", async () => {
    expect(await (await webhook(webhookRequest("customer.created", { id: "cus_123" }))).json()).toMatchObject({ result: "ignored" });
    expect(await (await webhook(webhookRequest("payment_intent.succeeded", { id: "pi_unknown" }))).json()).toMatchObject({
      result: "ignored",
    });
  });
});
