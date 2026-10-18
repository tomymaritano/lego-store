import { beforeAll, beforeEach, afterEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { changeOrderStatus, getAdminOrder, listAdminOrders, refundKey } from "@/lib/admin/orders";
import { getDashboard } from "@/lib/admin/dashboard";
import { payOrder, prepareOrder } from "@/lib/orders/checkout";
import { handleStripeEvent } from "@/lib/orders/webhook";
import { createMockState, mockGateway, type MockGatewayState } from "@/lib/payments/mock";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { prepareOrderSchema } from "@/lib/validations/orders";
import type { OrderTransitionInput } from "@/lib/validations/admin";
import { resetAndSeed, testDb } from "./setup/db";
import { shipping } from "./setup/checkout";

/*
 * The admin's order management against the test database, with the mock
 * payment gateway: the status changes the design allows and nothing else,
 * the email on SHIPPED, cancelling a paid order (refund + stock back, all or
 * nothing, at most once, even when retried or clicked twice at once), the
 * audit trail, and the list filters and dashboard numbers.
 */

let state: MockGatewayState;
let gateway: PaymentGateway;
let admin: { id: string; email: string };

const stockOf = async (id: string) => (await testDb.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock;
const setStock = (id: string, stock: number) => testDb.product.update({ where: { id }, data: { stock } });
const orderRow = (id: string) => testDb.order.findUniqueOrThrow({ where: { id }, include: { statusChanges: true } });

let events = 0;

/** An order through the real checkout: prepared, paid with the mock card and, unless `pending`, confirmed by the webhook. */
async function placeOrder(lines: { productId: string; quantity: number }[], { pending = false } = {}) {
  const outcome = await prepareOrder(
    testDb,
    gateway,
    prepareOrderSchema.parse({ shipping, lines, confirmationTokenId: "ctoken_mock_visa" }),
    { userId: null, access: null }
  );
  if (!outcome.ok) throw new Error(outcome.code);
  const order = await testDb.order.findUniqueOrThrow({ where: { id: outcome.order.id } });
  if (pending) return order;
  const paid = await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", { userId: null, access: outcome.access });
  if (!paid.ok) throw new Error(paid.code);
  const intent = await gateway.retrieveIntent(order.stripePaymentIntentId!);
  const result = await handleStripeEvent(testDb, gateway, {
    id: `evt_admin_${++events}`,
    type: "payment_intent.succeeded",
    data: { object: { id: intent.id, amount_received: intent.amount, currency: "ars" } },
  });
  expect(result.result).toBe("paid");
  return testDb.order.findUniqueOrThrow({ where: { id: order.id } });
}

const move = (orderId: string, to: OrderTransitionInput["to"], expected: OrderTransitionInput["expected"], gw: PaymentGateway | null = gateway) =>
  changeOrderStatus(testDb, gw, { orderId, to, expected }, admin);

let emails: MockInstance<typeof console.info>;
const sentEmails = () => emails.mock.calls.map((call) => String(call[0])).filter((text) => text.startsWith("\n[email]"));

beforeAll(async () => {
  await resetAndSeed();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  admin = await testDb.user.create({ data: { email: "jefa@admin.test", name: "Jefa", role: "ADMIN" }, select: { id: true, email: true } });
});

beforeEach(async () => {
  state = createMockState();
  gateway = mockGateway(state);
  emails = vi.spyOn(console, "info").mockImplementation(() => {});
  await Promise.all([setStock("5", 8), setStock("7", 40), setStock("15", 3)]);
});

afterEach(() => {
  emails.mockRestore();
});

describe("changeOrderStatus: shipping and delivery", () => {
  it("PAID -> SHIPPED stamps shippedAt, records who did it and emails the customer", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 2 }]);
    emails.mockClear();

    const result = await move(order.id, "SHIPPED", "PAID");
    expect(result).toEqual({ ok: true, changed: true, status: "SHIPPED", restockedProductIds: [], refundId: null });

    const row = await orderRow(order.id);
    expect(row.status).toBe("SHIPPED");
    expect(row.shippedAt).not.toBeNull();
    expect(row.statusChanges).toEqual([
      expect.objectContaining({ fromStatus: "PAID", toStatus: "SHIPPED", actorId: admin.id, actorEmail: "jefa@admin.test", refundId: null }),
    ]);
    const [email] = sentEmails();
    expect(email).toContain("Para: ana@example.com");
    expect(email).toMatch(/Asunto: Tu pedido LEGO-\d{6} está en camino/);
    // Shipping does not touch the stock taken at payment.
    expect(await stockOf("7")).toBe(38);
  });

  it("SHIPPED -> DELIVERED; the detail shows the whole audit trail in order", async () => {
    const order = await placeOrder([{ productId: "5", quantity: 1 }]);
    await move(order.id, "SHIPPED", "PAID");
    expect(await move(order.id, "DELIVERED", "SHIPPED")).toMatchObject({ ok: true, changed: true, status: "DELIVERED" });

    const view = await getAdminOrder(testDb, order.id);
    expect(view).toMatchObject({ status: "DELIVERED", stripePaymentIntentId: order.stripePaymentIntentId, account: null });
    expect(view!.deliveredAt).not.toBeNull();
    expect(view!.history.map((change) => [change.from, change.to, change.actorEmail])).toEqual([
      ["PAID", "SHIPPED", "jefa@admin.test"],
      ["SHIPPED", "DELIVERED", "jefa@admin.test"],
    ]);
  });

  it("only the transitions of the design: no shipping a pending order, no skipping to delivered, no cancelling shipped or delivered ones", async () => {
    const pending = await placeOrder([{ productId: "7", quantity: 1 }], { pending: true });
    expect(await move(pending.id, "SHIPPED", "PENDING")).toEqual({ ok: false, reason: "not_allowed", status: "PENDING" });
    expect(await move(pending.id, "DELIVERED", "PENDING")).toEqual({ ok: false, reason: "not_allowed", status: "PENDING" });

    const paid = await placeOrder([{ productId: "7", quantity: 1 }]);
    expect(await move(paid.id, "DELIVERED", "PAID")).toEqual({ ok: false, reason: "not_allowed", status: "PAID" });

    await move(paid.id, "SHIPPED", "PAID");
    expect(await move(paid.id, "CANCELLED", "SHIPPED")).toEqual({ ok: false, reason: "not_allowed", status: "SHIPPED" });
    await move(paid.id, "DELIVERED", "SHIPPED");
    expect(await move(paid.id, "CANCELLED", "DELIVERED")).toEqual({ ok: false, reason: "not_allowed", status: "DELIVERED" });
    expect((await orderRow(paid.id)).status).toBe("DELIVERED");
    expect(state.refunds.size).toBe(0);
  });

  it("is safe to repeat, and refuses a change based on a stale status", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 1 }]);
    await move(order.id, "SHIPPED", "PAID");
    emails.mockClear();
    // A second click: already there, nothing happens (no second email, no second audit row).
    expect(await move(order.id, "SHIPPED", "PAID")).toMatchObject({ ok: true, changed: false, status: "SHIPPED" });
    expect(sentEmails()).toEqual([]);
    // Someone acting on what they saw before the order shipped.
    expect(await move(order.id, "CANCELLED", "PAID")).toEqual({ ok: false, reason: "conflict", status: "SHIPPED" });
    expect((await orderRow(order.id)).statusChanges).toHaveLength(1);
    expect(await move("no-such-order", "SHIPPED", "PAID")).toEqual({ ok: false, reason: "not_found" });
  });

  it("works without a payment gateway for shipping (payments not configured)", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 1 }]);
    expect(await move(order.id, "SHIPPED", "PAID", null)).toMatchObject({ ok: true, changed: true });
  });
});

describe("changeOrderStatus: cancelling", () => {
  it("PENDING -> CANCELLED cancels the PaymentIntent, nothing is refunded and no stock moves", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 3 }], { pending: true });
    const result = await move(order.id, "CANCELLED", "PENDING");
    expect(result).toEqual({ ok: true, changed: true, status: "CANCELLED", restockedProductIds: [], refundId: null });
    const row = await orderRow(order.id);
    expect(row).toMatchObject({ status: "CANCELLED", cancelReason: "admin", stripeRefundId: null });
    expect((await gateway.retrieveIntent(order.stripePaymentIntentId!)).status).toBe("canceled");
    expect(await stockOf("7")).toBe(40);
    expect(state.refunds.size).toBe(0);
  });

  it("refuses to cancel a pending order whose payment already went through (the webhook settles it first)", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 1 }], { pending: true });
    // The customer pressed "Realizar pedido"; Stripe has not called the webhook yet.
    await gateway.confirmIntent(order.stripePaymentIntentId!, "ctoken_mock_visa", "test-confirm");
    expect(await move(order.id, "CANCELLED", "PENDING")).toEqual({ ok: false, reason: "payment_in_flight" });
    expect((await orderRow(order.id)).status).toBe("PENDING");
  });

  it("PAID -> CANCELLED refunds the payment in Stripe and puts the stock back, in one go", async () => {
    const order = await placeOrder([
      { productId: "7", quantity: 2 },
      { productId: "5", quantity: 3 },
    ]);
    expect([await stockOf("7"), await stockOf("5")]).toEqual([38, 5]);

    const result = await move(order.id, "CANCELLED", "PAID");
    expect(result).toMatchObject({ ok: true, changed: true, status: "CANCELLED", restockedProductIds: ["5", "7"] });
    const refundId = (result as { refundId: string }).refundId;
    expect(refundId).toMatch(/^re_mock_/);
    expect([...state.refunds.values()]).toEqual([{ id: refundId, intentId: order.stripePaymentIntentId }]);

    expect([await stockOf("7"), await stockOf("5")]).toEqual([40, 8]);
    const row = await orderRow(order.id);
    expect(row).toMatchObject({ status: "CANCELLED", cancelReason: "admin", stripeRefundId: refundId });
    expect(row.cancelledAt).not.toBeNull();
    expect(row.statusChanges).toEqual([expect.objectContaining({ fromStatus: "PAID", toStatus: "CANCELLED", refundId })]);
  });

  it("if Stripe refuses the refund, nothing changes: the order stays PAID and the stock where it was", async () => {
    const order = await placeOrder([{ productId: "15", quantity: 2 }]);
    const failing: PaymentGateway = { ...gateway, refund: async () => Promise.reject(new Error("Stripe is down")) };
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    expect(await move(order.id, "CANCELLED", "PAID", failing)).toEqual({ ok: false, reason: "refund_failed" });
    const row = await orderRow(order.id);
    expect(row).toMatchObject({ status: "PAID", stripeRefundId: null, cancelledAt: null });
    expect(row.statusChanges).toEqual([]);
    expect(await stockOf("15")).toBe(1);

    // Trying again once Stripe is back works.
    expect(await move(order.id, "CANCELLED", "PAID")).toMatchObject({ ok: true, changed: true });
    expect(await stockOf("15")).toBe(3);
  });

  it("a refund that went through while the save failed is not repeated on retry (same idempotency key, one refund)", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 1 }]);
    const keys: string[] = [];
    // Stripe makes the refund, but the answer never arrives (the transaction rolls back).
    const lost: PaymentGateway = {
      ...gateway,
      refund: async (intentId, key) => {
        keys.push(key);
        await gateway.refund(intentId, key);
        throw new Error("socket hang up");
      },
    };
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await move(order.id, "CANCELLED", "PAID", lost)).toEqual({ ok: false, reason: "refund_failed" });
    expect(await stockOf("7")).toBe(39);

    const retried = await move(order.id, "CANCELLED", "PAID");
    expect(retried).toMatchObject({ ok: true, changed: true });
    expect(keys).toEqual([refundKey(order.id)]);
    // One refund in Stripe, the one the order now records.
    expect(state.refunds.size).toBe(1);
    expect((await orderRow(order.id)).stripeRefundId).toBe([...state.refunds.keys()][0]);
    expect(await stockOf("7")).toBe(40);
  });

  it("two admins cancelling at the same moment: one refund, the stock back once", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 4 }]);
    expect(await stockOf("7")).toBe(36);
    const results = await Promise.all([move(order.id, "CANCELLED", "PAID"), move(order.id, "CANCELLED", "PAID")]);
    expect(results.map((result) => result.ok && result.changed).sort()).toEqual([false, true]);
    expect(state.refunds.size).toBe(1);
    expect(await stockOf("7")).toBe(40);
    expect((await orderRow(order.id)).statusChanges).toHaveLength(1);
  });

  it("a deleted product's line has no stock to go back to; the rest still does", async () => {
    const product = await testDb.product.create({
      data: {
        name: "Set efímero",
        price: 500,
        categoryId: "cars",
        type: "Set",
        age: "9+",
        theme: "Prueba",
        interests: [],
        pieces: "1-100",
        highlight: "Prueba",
        img: "/images/lego.png",
        images: ["/images/lego.png"],
        stock: 5,
        shortDescription: "Corto",
        description: "Largo",
        searchText: "set efimero",
        searchName: "set efimero",
      },
    });
    const order = await placeOrder([
      { productId: product.id, quantity: 1 },
      { productId: "7", quantity: 1 },
    ]);
    await testDb.product.delete({ where: { id: product.id } });
    expect(await move(order.id, "CANCELLED", "PAID")).toMatchObject({ ok: true, changed: true, restockedProductIds: ["7"] });
    expect(await stockOf("7")).toBe(40);
  });

  it("without a gateway a paid order cannot be refunded, so it is not cancelled", async () => {
    const order = await placeOrder([{ productId: "7", quantity: 1 }]);
    expect(await move(order.id, "CANCELLED", "PAID", null)).toEqual({ ok: false, reason: "payments_unconfigured" });
    expect((await orderRow(order.id)).status).toBe("PAID");
    expect(await stockOf("7")).toBe(39);
  });
});

describe("listAdminOrders and the dashboard", () => {
  it("filters by status, the amount_mismatch cancellations, email or number, and the store day it was placed", async () => {
    await testDb.order.deleteMany({ where: { email: { endsWith: "@lista.test" } } });
    const base = {
      firstName: "Lista",
      lastName: "Prueba",
      phone: "1",
      address: "Calle 1",
      city: "CABA",
      state: "CABA",
      zipCode: "1000",
      country: "Argentina",
      subtotal: 100,
      shipping: 0,
      total: 100,
    };
    const at = (iso: string) => ({ createdAt: new Date(iso), submittedAt: new Date(iso) });
    const mismatch = await testDb.order.create({
      data: { ...base, email: "mal@lista.test", status: "CANCELLED", cancelReason: "amount_mismatch", ...at("2026-10-10T15:00:00Z") },
    });
    const shipped = await testDb.order.create({
      data: { ...base, email: "bien@lista.test", status: "SHIPPED", ...at("2026-10-12T02:30:00Z") },
    });
    // Created at 23:50 of the 12th (store time), placed at 00:10 of the 13th: it belongs to the 13th.
    const pastMidnight = await testDb.order.create({
      data: {
        ...base,
        email: "medianoche@lista.test",
        status: "PAID",
        createdAt: new Date("2026-10-13T02:50:00Z"),
        submittedAt: new Date("2026-10-13T03:10:00Z"),
      },
    });
    // A checkout that reached "Revisar pedido" and stopped: no payment attempt.
    const draft = await testDb.order.create({
      data: { ...base, email: "borrador@lista.test", status: "PENDING", createdAt: new Date("2026-10-13T15:00:00Z") },
    });

    const list = (filters: Partial<Parameters<typeof listAdminOrders>[1]>) =>
      listAdminOrders(testDb, { status: "", q: "", from: "", to: "", page: 1, ...filters });
    const ids = async (filters: Partial<Parameters<typeof listAdminOrders>[1]>) => (await list(filters)).items.map((order) => order.id);

    // Placed orders only, the last placed first; the draft only under its own filter.
    expect(await ids({ q: "@lista.test" })).toEqual([pastMidnight.id, shipped.id, mismatch.id]);
    expect(await ids({ q: "@lista.test", status: "PENDING" })).toEqual([]);
    expect(await ids({ q: "@lista.test", status: "draft" })).toEqual([draft.id]);
    expect(await ids({ status: "amount_mismatch" })).toEqual([mismatch.id]);
    expect(await ids({ q: "BIEN@LISTA" })).toEqual([shipped.id]);
    expect(await ids({ q: `LEGO-${String(shipped.number).padStart(6, "0")}` })).toEqual([shipped.id]);
    expect(await ids({ q: "@lista.test", status: "SHIPPED" })).toEqual([shipped.id]);
    // 2026-10-12T02:30Z is still the 11th in Argentina (UTC-3).
    expect(await ids({ q: "@lista.test", from: "2026-10-11", to: "2026-10-11" })).toEqual([shipped.id]);
    // By the day it was placed (what the table shows and "Pedidos de hoy" counts), not created.
    expect(await ids({ q: "@lista.test", from: "2026-10-13", to: "2026-10-13" })).toEqual([pastMidnight.id]);
    expect(await ids({ q: "@lista.test", from: "2026-10-12", to: "2026-10-12" })).toEqual([]);
    // A draft's day is its creation's.
    expect(await ids({ q: "@lista.test", status: "draft", from: "2026-10-13", to: "2026-10-13" })).toEqual([draft.id]);
    expect(await ids({ q: "@lista.test", from: "2026-10-14" })).toEqual([]);
    // A LIKE wildcard in the search is a literal character.
    expect((await list({ q: "%" })).items).toEqual([]);
  });

  it("dashboard: today's orders and revenue, orders to ship, low stock and mismatches", async () => {
    await testDb.order.deleteMany({});
    await setStock("15", 0);
    await setStock("5", 2);
    const order = await placeOrder([{ productId: "7", quantity: 1 }]);
    const dashboard = await getDashboard(testDb);
    expect(dashboard).toMatchObject({
      ordersToday: 1,
      revenue: order.total,
      revenueToday: order.total,
      toShip: 1,
      awaitingPayment: 0,
      amountMismatches: 0,
    });
    expect(dashboard.outOfStock).toBeGreaterThanOrEqual(1);
    expect(dashboard.lowStockProducts.map((product) => product.id).slice(0, 2)).toEqual(["15", "5"]);
    expect(dashboard.recentOrders[0]).toMatchObject({ id: order.id, status: "PAID" });

    // A checkout abandoned at "Revisar pedido" is neither on the dashboard nor in the list it links to.
    await placeOrder([{ productId: "7", quantity: 1 }], { pending: true });
    expect((await getDashboard(testDb)).ordersByStatus.PENDING).toBe(0);
    expect((await listAdminOrders(testDb, { status: "PENDING", q: "", from: "", to: "", page: 1 })).total).toBe(0);
    expect((await listAdminOrders(testDb, { status: "draft", q: "", from: "", to: "", page: 1 })).total).toBe(1);

    await move(order.id, "CANCELLED", "PAID");
    expect(await getDashboard(testDb)).toMatchObject({ revenue: 0, toShip: 0 });
  });
});
