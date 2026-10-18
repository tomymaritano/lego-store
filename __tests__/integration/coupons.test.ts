import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createCoupon, getAdminCoupon, listAdminCoupons, setCouponActive, updateCoupon } from "@/lib/admin/coupons";
import { changeOrderStatus } from "@/lib/admin/orders";
import { storeDayEnd } from "@/lib/admin/format";
import type { Requester } from "@/lib/orders/access";
import { payOrder, prepareOrder } from "@/lib/orders/checkout";
import { expireStaleOrders } from "@/lib/orders/expire";
import { payMercadoPagoOrder, prepareMercadoPagoOrder } from "@/lib/orders/mercadopago";
import { getMercadoPago, getMercadoPagoMockControls } from "@/lib/payments/config";
import { toCentavos } from "@/lib/payments/gateway";
import { mpMockToken } from "@/lib/payments/mercadopago/mock-options";
import { mockGateway } from "@/lib/payments/mock";
import type { MercadoPagoClient } from "@/lib/payments/mercadopago/types";
import { couponFormSchema } from "@/lib/validations/coupons";
import { prepareMercadoPagoOrderSchema, prepareOrderSchema, type PayMercadoPagoOrderInput } from "@/lib/validations/orders";
import { resetAndSeed, testDb } from "./setup/db";
import { cookieOf, enableMockPayments, jsonRequest, mercadoPagoNotification, shipping, webhookRequest } from "./setup/checkout";

/*
 * Coupons against the test database, through the checkout's real code paths
 * (and its Route Handlers where it matters) with both payment providers'
 * mocks at the boundary: the quote, the reservation when the order is
 * prepared (discount in the order and in what the provider charges), every
 * limit (total, per account, per guest email) including under parallel
 * checkouts, the short hold of an unpaid checkout and the check when the
 * payment is submitted (so unpaid checkouts cannot take a coupon's or a
 * customer's uses, and no answer tells whether an email used a coupon), and
 * the use following the order: redeemed when paid, released when it is
 * cancelled by any path (cleanup, admin, refund, chargeback, an expired cash
 * ticket).
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});

enableMockPayments({ provider: "mercadopago" });

const { POST: quoteRoute } = await import("@/app/api/checkout/coupon/route");
const { POST: prepareRoute } = await import("@/app/api/checkout/orders/route");
const { POST: mpWebhook } = await import("@/app/api/webhooks/mercadopago/route");
const { POST: stripeWebhook } = await import("@/app/api/stripe/webhook/route");

let mp: MercadoPagoClient;
const controls = () => getMercadoPagoMockControls()!;
let ana: { id: string; email: string };
let admin: { id: string; email: string };

const guest: Requester = { userId: null, access: null };
const DAY = 24 * 60 * 60 * 1000;
const BATMOBILE = { productId: "7", quantity: 1 }; // $2490
const setStock = (id: string, stock: number) => testDb.product.update({ where: { id }, data: { stock } });

let codes = 0;
/** A coupon of the test's own (unique code), straight in the database. */
async function coupon(data: Partial<Parameters<typeof testDb.coupon.create>[0]["data"]> = {}) {
  return testDb.coupon.create({
    data: { code: `TEST${++codes}X${Date.now() % 100000}`, type: "PERCENT", value: 10, ...data },
  });
}

const redemption = (orderId: string) => testDb.couponRedemption.findUnique({ where: { orderId } });
/** The order's hold ran out (as if COUPON_HOLD_MS had passed without a payment). */
const lapse = (orderId: string) => testDb.couponRedemption.update({ where: { orderId }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });

async function prepareMp(
  couponCode: string | undefined,
  { requester = guest, email = shipping.email, lines = [BATMOBILE] }: { requester?: Requester; email?: string; lines?: { productId: string; quantity: number }[] } = {}
) {
  return prepareMercadoPagoOrder(
    testDb,
    { stripe: null, mercadopago: mp },
    prepareMercadoPagoOrderSchema.parse({ shipping: { ...shipping, email }, lines, provider: "MERCADOPAGO", ...(couponCode ? { couponCode } : {}) }),
    requester
  );
}

async function preparedMp(couponCode: string | undefined, options: Parameters<typeof prepareMp>[1] = {}) {
  const outcome = await prepareMp(couponCode, options);
  if (!outcome.ok) throw new Error(`prepare failed: ${outcome.code}${"message" in outcome ? ` ${outcome.message}` : ""}`);
  return { order: outcome.order, requester: { userId: options.requester?.userId ?? null, access: outcome.access ?? options.requester?.access ?? null } };
}

const card = (): PayMercadoPagoOrderInput => ({
  attemptId: randomUUID(),
  method: "card",
  formData: { token: mpMockToken("approved"), payment_method_id: "visa", installments: 1, payer: { email: "ana@example.com" } },
});
const cash = (): PayMercadoPagoOrderInput => ({ attemptId: randomUUID(), method: "ticket", formData: { payment_method_id: "rapipago" } });

const quote = async (body: unknown) => {
  const response = await quoteRoute(jsonRequest("/api/checkout/coupon", body));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

const notify = async (paymentId: string) => (await (await mpWebhook(mercadoPagoNotification(paymentId))).json()) as { result?: string };

let quiet: { mockRestore: () => void }[] = [];

beforeAll(async () => {
  await resetAndSeed();
  mp = getMercadoPago()!;
  ana = await testDb.user.create({ data: { email: "ana@coupons.test", name: "Ana" } });
  admin = await testDb.user.create({ data: { email: "admin@coupons.test", name: "Admin", role: "ADMIN" } });
});

beforeEach(async () => {
  session.current = null;
  await testDb.rateLimit.deleteMany();
  await Promise.all([setStock("5", 50), setStock("7", 50), setStock("20", 50)]);
  // Order emails go to the console in tests.
  quiet = [vi.spyOn(console, "info").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {})];
});

afterEach(() => quiet.forEach((spy) => spy.mockRestore()));

describe("POST /api/checkout/coupon (the cart's quote)", () => {
  it("prices the lines on the server and returns the coupon's terms and totals; codes are case-insensitive", async () => {
    const { status, body } = await quote({ code: "  bienvenida10 ", lines: [BATMOBILE, { productId: "5", quantity: 1 }] });
    expect(status).toBe(200);
    // Seeded: 10% from $2.000. $2490 + $189 = $2679; 10% = $267.90 → $268 (half up); $299 shipping.
    expect(body).toEqual({
      coupon: { code: "BIENVENIDA10", type: "PERCENT", value: 10, minSubtotal: 2000, label: "10% de descuento" },
      totals: { subtotal: 2679, discount: 268, shipping: 299, total: 2710, count: 2, coupon: { code: "BIENVENIDA10", applies: true, shortBy: 0 } },
    });
  });

  it("accepts a coupon below its minimum, says what is missing, and discounts nothing yet", async () => {
    const { status, body } = await quote({ code: "LEGO500", lines: [BATMOBILE] });
    expect(status).toBe(200);
    expect(body.totals).toMatchObject({ subtotal: 2490, discount: 0, total: 2789, coupon: { applies: false, shortBy: 1510 } });
  });

  it("refuses unknown, off, not yet valid, expired and used-up coupons, with the reason in Spanish", async () => {
    const off = await coupon({ active: false });
    const later = await coupon({ startsAt: new Date(Date.now() + 2 * DAY) });
    const over = await coupon({ expiresAt: storeDayEnd("2025-01-31") });
    const full = await coupon({ maxRedemptions: 1 });
    await preparedMp(full.code, { email: "first@coupons.test" });

    const cases = [
      ["NOEXISTE", "not_found", /no existe/],
      [off.code, "inactive", /ya no está disponible/],
      [later.code, "not_started", /todavía no está vigente: puedes usarlo desde el/],
      [over.code, "expired", /venció: era válido hasta el 31 de enero de 2025/],
      [full.code, "exhausted", /límite de usos/],
    ] as const;
    for (const [code, rejection, message] of cases) {
      const { status, body } = await quote({ code, lines: [BATMOBILE] });
      expect(status, code).toBe(422);
      expect(body).toMatchObject({ code: "coupon", rejection });
      expect(String(body.error)).toMatch(message);
    }
    const bad = await quote({ code: "no vale!", lines: [BATMOBILE] });
    expect(bad).toMatchObject({ status: 422, body: { code: "coupon", rejection: "invalid" } });
    expect((await quote({ code: "BIENVENIDA10", lines: [] })).status).toBe(400);
  });

  it("checks the per-customer limit of the signed-in account, never of an email someone types", async () => {
    const once = await coupon({ maxPerUser: 1 });
    const used = await preparedMp(once.code, { requester: { userId: ana.id, access: null }, email: ana.email });
    await payMercadoPagoOrder(testDb, mp, used.order.id, card(), used.requester);

    session.current = { user: { id: ana.id, role: "USER" }, sessionVersion: 0 };
    expect((await quote({ code: once.code, lines: [BATMOBILE] })).body).toMatchObject({ rejection: "per_customer" });
    session.current = null;
    expect((await quote({ code: once.code, lines: [BATMOBILE] })).status).toBe(200);
    // A visitor's answer is the same whether or not that email used it: the quote tells nothing about anyone's orders.
    const withEmail = await quote({ code: once.code, lines: [BATMOBILE], email: ana.email });
    const without = await quote({ code: once.code, lines: [BATMOBILE], email: "nadie@coupons.test" });
    expect(withEmail).toEqual(without);
    expect(withEmail.status).toBe(200);
  });

  it("re-checks have their own, larger budget", async () => {
    for (let i = 0; i < 20; i++) await quote({ code: `NOPE${i}`, lines: [BATMOBILE] });
    expect((await quote({ code: "BIENVENIDA10", lines: [BATMOBILE] })).status).toBe(429);
    expect((await quote({ code: "BIENVENIDA10", lines: [BATMOBILE], recheck: true })).status).toBe(200);
  });

  it("limits how many codes one visitor can try", async () => {
    for (let i = 0; i < 20; i++) expect((await quote({ code: `NOPE${i}`, lines: [BATMOBILE] })).status).toBe(422);
    const limited = await quote({ code: "BIENVENIDA10", lines: [BATMOBILE] });
    expect(limited.status).toBe(429);
  });
});

describe("preparing the order reserves the coupon and prices it", () => {
  it("stores the code and the discount on the order, reserves a use, and Mercado Pago charges the discounted total", async () => {
    const { order, requester } = await preparedMp("bienvenida10");
    expect(order).toMatchObject({ subtotal: 2490, discount: 249, couponCode: "BIENVENIDA10", shipping: 299, total: 2540 });
    expect(await redemption(order.id)).toMatchObject({ status: "RESERVED", discount: 249, email: "ana@example.com", userId: null });

    const create = vi.spyOn(mp, "createPayment");
    const paid = await payMercadoPagoOrder(testDb, mp, order.id, card(), requester);
    expect(paid).toMatchObject({ ok: true, order: { status: "PAID", total: 2540 } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ transaction_amount: 2540 }), expect.any(String));
    expect(await redemption(order.id)).toMatchObject({ status: "REDEEMED", redeemedAt: expect.any(Date) });
    create.mockRestore();
  });

  it("Stripe: the PaymentIntent is for the discounted total, and the paid webhook redeems the use", async () => {
    const gateway = mockGateway();
    const createIntent = vi.spyOn(gateway, "createIntent");
    const outcome = await prepareOrder(
      testDb,
      gateway,
      prepareOrderSchema.parse({ shipping, lines: [BATMOBILE, { productId: "20", quantity: 3 }], confirmationTokenId: "ctoken_mock_visa", couponCode: "LEGO500" }),
      guest
    );
    if (!outcome.ok) throw new Error(outcome.code);
    // $2490 + 3 × $799 = $4887, $500 off, $299 shipping.
    expect(outcome.order).toMatchObject({ subtotal: 4887, discount: 500, total: 4686 });
    expect(createIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: toCentavos(4686) }));

    const row = await testDb.order.findUniqueOrThrow({ where: { id: outcome.order.id } });
    const response = await stripeWebhook(
      webhookRequest("payment_intent.succeeded", { id: row.stripePaymentIntentId!, orderId: row.id, amountReceived: toCentavos(4686) })
    );
    expect(response.status).toBe(200);
    expect(await redemption(row.id)).toMatchObject({ status: "REDEEMED" });
  });

  it("refuses an order whose coupon cannot be used, writing nothing, through the Route Handler", async () => {
    const over = await coupon({ expiresAt: new Date(Date.now() - DAY) });
    const before = await testDb.order.count();
    const response = await prepareRoute(jsonRequest("/api/checkout/orders", { shipping, lines: [BATMOBILE], provider: "MERCADOPAGO", couponCode: over.code }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "coupon", rejection: "expired", error: expect.stringMatching(/venció/) });
    expect(cookieOf(response)).toBeNull();
    expect(await testDb.order.count()).toBe(before);
  });

  it("the order itself needs the coupon's minimum subtotal", async () => {
    const outcome = await prepareMp("LEGO500");
    expect(outcome).toMatchObject({ ok: false, code: "coupon", rejection: "min_subtotal", message: expect.stringMatching(/desde \$\s?4\.000: te faltan \$\s?1\.510/) });
  });

  it("re-preparing the same order switches or drops its coupon (its own reservation does not count against it)", async () => {
    const once = await coupon({ maxRedemptions: 1, type: "FIXED", value: 300 });
    const email = "switch@coupons.test";
    const first = await preparedMp(once.code, { email });
    // Same browser, same coupon: its own use is not "another" one.
    const again = await preparedMp(once.code, { requester: first.requester, email });
    expect(again.order.id).toBe(first.order.id);
    expect(again.order).toMatchObject({ discount: 300, total: 2490 - 300 + 299 });

    const switched = await preparedMp("BIENVENIDA10", { requester: first.requester, email });
    expect(switched.order).toMatchObject({ id: first.order.id, couponCode: "BIENVENIDA10", discount: 249 });
    expect(await redemption(first.order.id)).toMatchObject({ couponId: (await testDb.coupon.findUniqueOrThrow({ where: { code: "BIENVENIDA10" } })).id });

    const dropped = await preparedMp(undefined, { requester: first.requester, email });
    expect(dropped.order).toMatchObject({ id: first.order.id, couponCode: null, discount: 0, total: 2789 });
    expect(await redemption(first.order.id)).toBeNull();
    // The single use is free again.
    expect((await prepareMp(once.code, { email: "other@coupons.test" })).ok).toBe(true);
  });

  it("an order covered entirely by a coupon still pays shipping (never a $0 order)", async () => {
    const all = await coupon({ type: "FIXED", value: 100_000 });
    const { order } = await preparedMp(all.code, { lines: [{ productId: "7", quantity: 3 }] });
    expect(order).toMatchObject({ subtotal: 7470, discount: 7470, shipping: 299, total: 299 });
  });
});

describe("limits", () => {
  it("per customer: an account cannot use it again from another browser, even before paying", async () => {
    const once = await coupon({ maxPerUser: 1 });
    const asAna: Requester = { userId: ana.id, access: null };
    await preparedMp(once.code, { requester: asAna, email: ana.email });
    expect(await prepareMp(once.code, { requester: asAna, email: "otra@coupons.test" })).toMatchObject({ ok: false, rejection: "per_customer" });
    expect((await prepareMp(once.code, { email: "nadie@coupons.test" })).ok).toBe(true);
  });

  it("per customer by email: checked when the payment is submitted, counting only paid or submitted uses", async () => {
    const once = await coupon({ maxPerUser: 1 });
    const email = "ana-guest@coupons.test";
    const first = await preparedMp(once.code, { email });
    // Unpaid, it takes nothing from that email: another checkout with it is prepared (and says nothing about the first).
    const second = await preparedMp(once.code, { email });
    expect(second.order.id).not.toBe(first.order.id);

    expect(await payMercadoPagoOrder(testDb, mp, first.order.id, card(), first.requester)).toMatchObject({ ok: true, order: { status: "PAID" } });
    const create = vi.spyOn(mp, "createPayment");
    const refused = await payMercadoPagoOrder(testDb, mp, second.order.id, card(), second.requester);
    expect(refused).toMatchObject({ ok: false, code: "coupon", rejection: "per_customer", message: expect.stringMatching(/Ya usaste este cupón/) });
    // Refused before anything was charged; the order is still at the checkout, to prepare again without it.
    expect(create).not.toHaveBeenCalled();
    create.mockRestore();
    expect((await testDb.order.findUniqueOrThrow({ where: { id: second.order.id } })).status).toBe("PENDING");

    // An account's guest orders with its email count too, once paid.
    const asAna: Requester = { userId: ana.id, access: null };
    const mine = await preparedMp(once.code, { requester: asAna, email });
    expect(await payMercadoPagoOrder(testDb, mp, mine.order.id, card(), mine.requester)).toMatchObject({ ok: false, code: "coupon", rejection: "per_customer" });
  });

  it("nobody can use up someone else's per-customer allowance with unpaid checkouts in their name", async () => {
    const once = await coupon({ maxPerUser: 1 });
    const victim = "victima@coupons.test";
    // Anonymous checkouts with the victim's email, never paid.
    for (let i = 0; i < 3; i++) await preparedMp(once.code, { email: victim });
    const own = await preparedMp(once.code, { email: victim });
    expect(await payMercadoPagoOrder(testDb, mp, own.order.id, card(), own.requester)).toMatchObject({ ok: true, order: { status: "PAID", discount: 249 } });
  });

  it("an unpaid checkout holds its use only for a while; then the next customer gets it, and the first is refused when paying", async () => {
    const one = await coupon({ maxRedemptions: 1 });
    const first = await preparedMp(one.code, { email: "slow@coupons.test" });
    const held = await redemption(first.order.id);
    expect(held?.holdExpiresAt?.getTime()).toBeGreaterThan(Date.now() + 25 * 60 * 1000);
    expect(held?.holdExpiresAt?.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60 * 1000);
    expect(await prepareMp(one.code, { email: "next@coupons.test" })).toMatchObject({ ok: false, rejection: "exhausted" });

    await lapse(first.order.id);
    const next = await preparedMp(one.code, { email: "next@coupons.test" });
    const create = vi.spyOn(mp, "createPayment");
    expect(await payMercadoPagoOrder(testDb, mp, first.order.id, card(), first.requester)).toMatchObject({ ok: false, code: "coupon", rejection: "exhausted" });
    expect(create).not.toHaveBeenCalled();
    create.mockRestore();
    expect(await payMercadoPagoOrder(testDb, mp, next.order.id, card(), next.requester)).toMatchObject({ ok: true, order: { status: "PAID" } });
    // The first browser prepares its order again without the coupon, at the full total.
    const again = await preparedMp(undefined, { requester: first.requester, email: "slow@coupons.test" });
    expect(again.order).toMatchObject({ id: first.order.id, couponCode: null, total: 2789 });
  });

  it("a lapsed hold whose place is still free is held again when paying", async () => {
    const one = await coupon({ maxRedemptions: 1 });
    const { order, requester } = await preparedMp(one.code, { email: "late-but-ok@coupons.test" });
    await lapse(order.id);
    expect(await payMercadoPagoOrder(testDb, mp, order.id, card(), requester)).toMatchObject({ ok: true, order: { status: "PAID" } });
    expect(await redemption(order.id)).toMatchObject({ status: "REDEEMED", holdExpiresAt: null });
  });

  it("submitting the payment holds the use until the order settles; a refused card puts the short hold back", async () => {
    const { order, requester } = await preparedMp("BIENVENIDA10", { email: "declined@coupons.test" });
    const rejected: PayMercadoPagoOrderInput = { ...card(), formData: { ...card().formData!, token: mpMockToken("rejected") } };
    expect(await payMercadoPagoOrder(testDb, mp, order.id, rejected, requester)).toMatchObject({ ok: false, code: "declined" });
    expect((await redemption(order.id))?.holdExpiresAt).not.toBeNull();

    // A cash ticket: Mercado Pago has the payment, the order waits on it and holds its coupon.
    await payMercadoPagoOrder(testDb, mp, order.id, cash(), requester);
    expect(await redemption(order.id)).toMatchObject({ status: "RESERVED", holdExpiresAt: null });
  });

  it("Checkout Pro only renews the short hold; the order holds it once it waits on Mercado Pago's payment", async () => {
    const { order, requester } = await preparedMp("BIENVENIDA10", { email: "wallet@coupons.test" });
    await lapse(order.id);
    expect(await payMercadoPagoOrder(testDb, mp, order.id, { attemptId: randomUUID(), method: "wallet" }, requester)).toMatchObject({ ok: true, next: "redirect" });
    expect((await redemption(order.id))?.holdExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    // The hold-expiry migration's trigger: an order waiting on a payment (PAYMENT_PENDING) holds it until it settles.
    await testDb.order.update({ where: { id: order.id }, data: { status: "PAYMENT_PENDING" } });
    expect(await redemption(order.id)).toMatchObject({ status: "RESERVED", holdExpiresAt: null });
  });

  it("a lapsed hold is a new use: an expired or deactivated coupon is refused when paying; a live hold keeps its use", async () => {
    const half = await coupon({ value: 50 });
    const late = await preparedMp(half.code, { email: "late-off@coupons.test" });
    const onTime = await preparedMp(half.code, { email: "on-time@coupons.test" });
    await testDb.coupon.update({ where: { id: half.id }, data: { active: false } });
    await lapse(late.order.id);
    const create = vi.spyOn(mp, "createPayment");
    expect(await payMercadoPagoOrder(testDb, mp, late.order.id, card(), late.requester)).toMatchObject({ ok: false, code: "coupon", rejection: "inactive" });
    expect(create).not.toHaveBeenCalled();
    create.mockRestore();
    // Held when the store turned it off: that order keeps the use it was promised.
    expect(await payMercadoPagoOrder(testDb, mp, onTime.order.id, card(), onTime.requester)).toMatchObject({ ok: true, order: { status: "PAID", discount: 1245 } });

    const ended = await coupon({ value: 50, expiresAt: new Date(Date.now() + DAY) });
    const expired = await preparedMp(ended.code, { email: "late-expired@coupons.test" });
    await testDb.coupon.update({ where: { id: ended.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await lapse(expired.order.id);
    expect(await payMercadoPagoOrder(testDb, mp, expired.order.id, card(), expired.requester)).toMatchObject({ ok: false, code: "coupon", rejection: "expired" });
    expect(await payMercadoPagoOrder(testDb, mp, expired.order.id, { attemptId: randomUUID(), method: "wallet" }, expired.requester)).toMatchObject({
      ok: false,
      code: "coupon",
      rejection: "expired",
    });
  });

  it("Checkout Pro with a coupon: the preference expires with the hold, and each click opens a new one", async () => {
    const { order, requester } = await preparedMp("BIENVENIDA10", { email: "wallet-expiry@coupons.test" });
    const wallet = (): PayMercadoPagoOrderInput => ({ attemptId: randomUUID(), method: "wallet" });
    const first = await payMercadoPagoOrder(testDb, mp, order.id, wallet(), requester);
    if (!first.ok || first.next !== "redirect") throw new Error("expected a redirect");
    const firstId = (await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).providerCheckoutId!;
    const hold = (await redemption(order.id))!.holdExpiresAt!;
    expect(controls().preference(firstId)?.request.expiration_date_to).toBe(hold.toISOString());

    const second = await payMercadoPagoOrder(testDb, mp, order.id, wallet(), requester);
    const secondId = (await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).providerCheckoutId!;
    expect(second).toMatchObject({ ok: true, next: "redirect" });
    expect(secondId).not.toBe(firstId);
    expect(controls().preference(firstId)?.expired).toBe(true);
    expect(controls().preference(secondId)?.request.expiration_date_to).toBe((await redemption(order.id))!.holdExpiresAt!.toISOString());
  });

  it("Checkout Pro paid after its hold lapsed and the last use was taken: refunded and cancelled, never over the limit", async () => {
    const one = await coupon({ maxRedemptions: 1 });
    const slow = await preparedMp(one.code, { email: "wallet-slow@coupons.test" });
    expect(await payMercadoPagoOrder(testDb, mp, slow.order.id, { attemptId: randomUUID(), method: "wallet" }, slow.requester)).toMatchObject({ ok: true, next: "redirect" });
    const preference = (await testDb.order.findUniqueOrThrow({ where: { id: slow.order.id } })).providerCheckoutId!;
    await lapse(slow.order.id);

    const fast = await preparedMp(one.code, { email: "wallet-fast@coupons.test" });
    expect(await payMercadoPagoOrder(testDb, mp, fast.order.id, card(), fast.requester)).toMatchObject({ ok: true, order: { status: "PAID" } });

    // A payment already under way when the preference closed still comes in.
    const late = controls().payPreference(preference, { force: true });
    expect(await notify(late.id)).toMatchObject({ result: "coupon_unavailable" });
    expect(await testDb.order.findUniqueOrThrow({ where: { id: slow.order.id } })).toMatchObject({
      status: "CANCELLED",
      cancelReason: "coupon_unavailable",
      providerRefundId: expect.any(String),
    });
    expect(controls().get(late.id)?.status).toBe("refunded");
    expect(await redemption(slow.order.id)).toMatchObject({ status: "RELEASED" });
    expect(await testDb.couponRedemption.count({ where: { couponId: one.id, status: "REDEEMED" } })).toBe(1);
    // No stock was taken for it.
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "7" } })).stock).toBe(49);
  });

  it("Checkout Pro cannot get round the per-customer limit by email with several preferences", async () => {
    const once = await coupon({ maxPerUser: 1 });
    const email = "wallet-many@coupons.test";
    const preferences: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { order, requester } = await preparedMp(once.code, { email });
      expect(await payMercadoPagoOrder(testDb, mp, order.id, { attemptId: randomUUID(), method: "wallet" }, requester)).toMatchObject({ ok: true, next: "redirect" });
      preferences.push((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).providerCheckoutId!);
    }
    const results = [];
    for (const preference of preferences) results.push((await notify(controls().payPreference(preference).id)).result);
    expect(results).toEqual(["paid", "coupon_unavailable", "coupon_unavailable"]);
    expect(await testDb.couponRedemption.count({ where: { couponId: once.id, email, status: "REDEEMED" } })).toBe(1);
  });

  it("Checkout Pro: a pending payment (a ticket) whose coupon no longer fits is cancelled before the order waits on it", async () => {
    const one = await coupon({ maxRedemptions: 1 });
    const slow = await preparedMp(one.code, { email: "wallet-ticket@coupons.test" });
    await payMercadoPagoOrder(testDb, mp, slow.order.id, { attemptId: randomUUID(), method: "wallet" }, slow.requester);
    await lapse(slow.order.id);
    const fast = await preparedMp(one.code, { email: "wallet-ticket-fast@coupons.test" });
    await payMercadoPagoOrder(testDb, mp, fast.order.id, card(), fast.requester);

    const preference = (await testDb.order.findUniqueOrThrow({ where: { id: slow.order.id } })).providerCheckoutId!;
    const approved = controls().payPreference(preference, { force: true });
    const ticket = controls().addPayment({
      ...approved,
      id: `${approved.id}9`,
      status: "pending",
      statusDetail: "pending_waiting_payment",
      paymentMethodId: "rapipago",
      paymentTypeId: "ticket",
    });
    expect(await notify(ticket.id)).toMatchObject({ result: "coupon_unavailable" });
    expect(controls().get(ticket.id)?.status).toBe("cancelled");
    expect(await testDb.order.findUniqueOrThrow({ where: { id: slow.order.id } })).toMatchObject({ status: "CANCELLED", cancelReason: "coupon_unavailable" });
    expect(await testDb.couponRedemption.count({ where: { couponId: one.id, status: { in: ["REDEEMED", "RESERVED"] } } })).toBe(1);
  });

  it("Stripe: the payment checks the coupon again before confirming anything", async () => {
    const one = await coupon({ maxRedemptions: 1 });
    const gateway = mockGateway();
    const prepare = async (email: string) => {
      const outcome = await prepareOrder(
        testDb,
        gateway,
        prepareOrderSchema.parse({ shipping: { ...shipping, email }, lines: [BATMOBILE], confirmationTokenId: "ctoken_mock_visa", couponCode: one.code }),
        guest
      );
      if (!outcome.ok) throw new Error(outcome.code);
      return { order: outcome.order, requester: { userId: null, access: outcome.access } satisfies Requester };
    };
    const first = await prepare("stripe-slow@coupons.test");
    await lapse(first.order.id);
    await prepare("stripe-next@coupons.test");
    const confirm = vi.spyOn(gateway, "confirmIntent");
    expect(await payOrder(testDb, gateway, first.order.id, "ctoken_mock_visa", first.requester)).toMatchObject({ ok: false, code: "coupon", rejection: "exhausted" });
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("never over-redeems under parallel checkouts: the total limit", async () => {
    const three = await coupon({ maxRedemptions: 3 });
    const outcomes = await Promise.all(Array.from({ length: 8 }, (_, i) => prepareMp(three.code, { email: `race${i}@coupons.test` })));
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(3);
    expect(outcomes.filter((outcome) => !outcome.ok && outcome.code === "coupon" && outcome.rejection === "exhausted")).toHaveLength(5);
    expect(await testDb.couponRedemption.count({ where: { couponId: three.id, status: "RESERVED" } })).toBe(3);
  });

  it("never over-redeems under parallel checkouts: the per-customer limit, by account and by email", async () => {
    const once = await coupon({ maxPerUser: 1 });
    const asAna: Requester = { userId: ana.id, access: null };
    const accounts = await Promise.all(Array.from({ length: 5 }, () => prepareMp(once.code, { requester: asAna, email: ana.email })));
    expect(accounts.filter((outcome) => outcome.ok)).toHaveLength(1);

    const sameEmail = await Promise.all(Array.from({ length: 5 }, () => preparedMp(once.code, { email: "same@coupons.test" })));
    const paid = await Promise.all(sameEmail.map(({ order, requester }) => payMercadoPagoOrder(testDb, mp, order.id, card(), requester)));
    expect(paid.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(paid.filter((outcome) => !outcome.ok && outcome.code === "coupon" && outcome.rejection === "per_customer")).toHaveLength(4);
    expect(await testDb.couponRedemption.count({ where: { couponId: once.id, email: "same@coupons.test", status: "REDEEMED" } })).toBe(1);
  });

  it("preparing orders with a coupon has its own rate limit, so a script cannot hold a coupon's uses", async () => {
    const body = { shipping: { ...shipping, email: "hoard@coupons.test" }, lines: [BATMOBILE], provider: "MERCADOPAGO", couponCode: "LEGO500" };
    const statuses: number[] = [];
    for (let i = 0; i < 16; i++) statuses.push((await prepareRoute(jsonRequest("/api/checkout/orders", body))).status);
    // Refused for its minimum (422) until the limit (429): each try counts.
    expect(statuses.slice(0, 15).every((status) => status === 422)).toBe(true);
    expect(statuses[15]).toBe(429);
    // Without a coupon, the checkout's own (larger) limit still has room.
    const { couponCode: _omit, ...plain } = body;
    void _omit;
    expect((await prepareRoute(jsonRequest("/api/checkout/orders", plain))).status).toBe(200);
  });
});

describe("the use follows its order", () => {
  it("the cleanup's cancellation of an abandoned checkout releases it, and someone else can use it", async () => {
    const once = await coupon({ maxRedemptions: 1 });
    const { order } = await preparedMp(once.code);
    expect(await prepareMp(once.code, { email: "late@coupons.test" })).toMatchObject({ ok: false, rejection: "exhausted" });

    await expireStaleOrders(testDb, { stripe: null, mercadopago: mp }, { now: new Date(Date.now() + 2 * DAY) });
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    expect(await redemption(order.id)).toMatchObject({ status: "RELEASED", releasedAt: expect.any(Date) });
    expect((await prepareMp(once.code, { email: "late@coupons.test" })).ok).toBe(true);
  });

  it("an admin's cancellation releases it: a pending order, and a paid one (refunded)", async () => {
    const actor = { id: admin.id, email: admin.email };
    const pending = await preparedMp("BIENVENIDA10", { email: "p1@coupons.test" });
    await changeOrderStatus(testDb, { stripe: null, mercadopago: mp }, { orderId: pending.order.id, to: "CANCELLED", expected: "PENDING" }, actor);
    expect(await redemption(pending.order.id)).toMatchObject({ status: "RELEASED" });

    const paid = await preparedMp("BIENVENIDA10", { email: "p2@coupons.test" });
    await payMercadoPagoOrder(testDb, mp, paid.order.id, card(), paid.requester);
    expect(await redemption(paid.order.id)).toMatchObject({ status: "REDEEMED" });
    const result = await changeOrderStatus(testDb, { stripe: null, mercadopago: mp }, { orderId: paid.order.id, to: "CANCELLED", expected: "PAID" }, actor);
    expect(result).toMatchObject({ ok: true, refundId: expect.any(String) });
    expect(await redemption(paid.order.id)).toMatchObject({ status: "RELEASED" });
  });

  it("a cash ticket keeps it reserved while unpaid, and its expiry releases it", async () => {
    const { order, requester } = await preparedMp("BIENVENIDA10", { email: "cash@coupons.test" });
    await payMercadoPagoOrder(testDb, mp, order.id, cash(), requester);
    const row = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe("PAYMENT_PENDING");
    expect(await redemption(order.id)).toMatchObject({ status: "RESERVED" });

    controls().setStatus(row.providerPaymentId!, "cancelled", "expired");
    expect((await notify(row.providerPaymentId!)).result).toBe("cancelled");
    expect(await redemption(order.id)).toMatchObject({ status: "RELEASED" });
  });

  it("a refund made in Mercado Pago, or a chargeback, releases it", async () => {
    for (const [status, detail] of [
      ["refunded", null],
      ["charged_back", "settled"],
    ] as const) {
      const { order, requester } = await preparedMp("BIENVENIDA10", { email: `${status}@coupons.test` });
      await payMercadoPagoOrder(testDb, mp, order.id, card(), requester);
      const paymentId = (await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).providerPaymentId!;
      if (status === "refunded") await mp.refundPayment(paymentId, { idempotencyKey: `dashboard/${paymentId}` });
      else controls().setStatus(paymentId, status, detail);
      await notify(paymentId);
      expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status, status).toBe("CANCELLED");
      expect(await redemption(order.id), status).toMatchObject({ status: "RELEASED" });
    }
  });
});

describe("admin", () => {
  const actor = () => ({ id: admin.id, email: admin.email });
  const form = (values: Partial<Record<string, string | boolean>> = {}) =>
    couponFormSchema.parse({
      code: "",
      description: "Primavera",
      type: "PERCENT",
      value: "15",
      minSubtotal: "",
      startsAt: "",
      expiresAt: "2030-12-31",
      maxRedemptions: "50",
      maxPerUser: "1",
      active: true,
      ...values,
    });

  it("creates a coupon with its audit entry; a taken code is refused", async () => {
    const created = await createCoupon(testDb, actor(), "PRIMAVERA15", form());
    if (!created.ok) throw new Error(created.reason);
    const row = await testDb.coupon.findUniqueOrThrow({ where: { id: created.couponId } });
    expect(row).toMatchObject({ code: "PRIMAVERA15", type: "PERCENT", value: 15, minSubtotal: 0, maxRedemptions: 50, maxPerUser: 1, active: true });
    // "Válido hasta" includes the day: it expires when the next store day starts (UTC-3).
    expect(row.expiresAt?.toISOString()).toBe("2031-01-01T03:00:00.000Z");
    expect(await testDb.auditLog.findMany({ where: { entityId: created.couponId } })).toEqual([
      expect.objectContaining({ action: "coupon.create", actorEmail: admin.email, actorId: admin.id, entityType: "coupon" }),
    ]);
    expect(await createCoupon(testDb, actor(), "PRIMAVERA15", form())).toEqual({ ok: false, reason: "code_taken" });
  });

  it("edits record what changed; deactivating stops new uses but keeps the orders that have one", async () => {
    const created = await createCoupon(testDb, actor(), "VERANO", form({ value: "20" }));
    if (!created.ok) throw new Error(created.reason);
    const { order } = await preparedMp("VERANO", { email: "verano@coupons.test" });

    expect(await updateCoupon(testDb, actor(), created.couponId, form({ value: "25", minSubtotal: "1000" }))).toMatchObject({ ok: true, changed: true });
    expect(await updateCoupon(testDb, actor(), created.couponId, form({ value: "25", minSubtotal: "1000" }))).toMatchObject({ ok: true, changed: false });
    expect(await setCouponActive(testDb, actor(), created.couponId, false)).toMatchObject({ ok: true, changed: true });

    const history = await testDb.auditLog.findMany({ where: { entityId: created.couponId }, orderBy: { createdAt: "asc" } });
    expect(history.map((entry) => entry.action)).toEqual(["coupon.create", "coupon.update", "coupon.deactivate"]);
    expect(history[1]!.changes).toEqual({ value: [20, 25], minSubtotal: [0, 1000] });

    // The order keeps its discount (a snapshot); new checkouts are refused.
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).discount).toBe(498);
    expect(await prepareMp("VERANO", { email: "otro@coupons.test" })).toMatchObject({ ok: false, rejection: "inactive" });
    expect(await updateCoupon(testDb, actor(), "missing", form())).toEqual({ ok: false, reason: "not_found" });
  });

  it("lists coupons with their status, uses against the limit and money impact", async () => {
    const tracked = await coupon({ type: "FIXED", value: 200, maxRedemptions: 2 });
    const a = await preparedMp(tracked.code, { email: "l1@coupons.test" });
    await payMercadoPagoOrder(testDb, mp, a.order.id, card(), a.requester);
    await preparedMp(tracked.code, { email: "l2@coupons.test" });
    const expiredOne = await coupon({ expiresAt: new Date(Date.now() - DAY) });

    const page = await listAdminCoupons(testDb, { q: "", status: "", page: 1 });
    const row = page.items.find((item) => item.id === tracked.id)!;
    expect(row).toMatchObject({ status: "exhausted", uses: 2, reserved: 1, lapsed: 0, redeemed: 1, discountGiven: 200, revenue: 2490 - 200 + 299, label: expect.stringMatching(/200 de descuento/) });
    expect(page.items.find((item) => item.id === expiredOne.id)?.status).toBe("expired");
    expect((await listAdminCoupons(testDb, { q: "", status: "expired", page: 1 })).items.every((item) => item.status === "expired")).toBe(true);
    expect((await listAdminCoupons(testDb, { q: tracked.code.toLowerCase(), status: "", page: 1 })).items.map((item) => item.id)).toEqual([tracked.id]);

    const detail = await getAdminCoupon(testDb, tracked.id);
    expect(detail?.redemptions.map((use) => use.status).sort()).toEqual(["REDEEMED", "RESERVED"]);

    // A hold that ran out without a payment no longer counts: the coupon has a use free again.
    const unpaid = detail!.redemptions.find((use) => use.status === "RESERVED")!;
    await lapse(unpaid.orderId);
    const after = (await listAdminCoupons(testDb, { q: tracked.code, status: "", page: 1 })).items[0]!;
    expect(after).toMatchObject({ status: "active", uses: 1, reserved: 0, lapsed: 1 });
    expect((await getAdminCoupon(testDb, tracked.id))?.redemptions.map((use) => use.status).sort()).toEqual(["LAPSED", "REDEEMED"]);
  });
});

describe("database rules", () => {
  it("an order's total is subtotal - discount + shipping, and a discount needs a coupon code", async () => {
    const base = { ...shipping, email: "db@coupons.test", zipCode: "C1043AAZ", subtotal: 1000, shipping: 299 };
    await expect(testDb.order.create({ data: { ...base, discount: 100, couponCode: "X", total: 1299 } })).rejects.toThrow();
    await expect(testDb.order.create({ data: { ...base, discount: 100, total: 1199 } })).rejects.toThrow();
    await expect(testDb.order.create({ data: { ...base, discount: 1001, couponCode: "X", total: 298 } })).rejects.toThrow();
    await expect(testDb.order.create({ data: { ...base, discount: 100, couponCode: "X", total: 1199 } })).resolves.toBeTruthy();
  });

  it("coupon codes are stored uppercase, and a percentage goes up to 100", async () => {
    await expect(testDb.coupon.create({ data: { code: "lower", type: "PERCENT", value: 10 } })).rejects.toThrow();
    await expect(testDb.coupon.create({ data: { code: "TOOMUCH", type: "PERCENT", value: 101 } })).rejects.toThrow();
    await expect(testDb.coupon.create({ data: { code: "BIGFIXED", type: "FIXED", value: 101 } })).resolves.toBeTruthy();
  });
});
