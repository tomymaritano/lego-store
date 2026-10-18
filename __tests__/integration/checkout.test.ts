import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashAccessToken, serializeCheckoutCookie, type CheckoutAccess, type Requester } from "@/lib/orders/access";
import { getCheckoutOrder, payOrder, prepareOrder } from "@/lib/orders/checkout";
import { expireStaleOrders } from "@/lib/orders/expire";
import { getUserOrder, listUserOrders } from "@/lib/orders/queries";
import { mockGateway } from "@/lib/payments/mock";
import { getPaymentGateway } from "@/lib/payments/config";
import { toCentavos, type PaymentGateway } from "@/lib/payments/gateway";
import { prepareOrderSchema, type PrepareOrderInput } from "@/lib/validations/orders";
import { resetAndSeed, testDb } from "./setup/db";
import { cookieOf, getRequest, jsonRequest, shipping, enableMockPayments } from "./setup/checkout";

/*
 * The checkout on the server against the test database: totals and stock
 * from the database, the PENDING order and its PaymentIntent, paying it, and
 * who may see or pay an order. Stripe is the in-memory mock gateway (the
 * boundary); Auth.js's auth() is stubbed with the session under test and
 * getCurrentUser() still checks it against the database.
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});

enableMockPayments();

const { POST: prepareRoute } = await import("@/app/api/checkout/orders/route");
const { GET: orderRoute } = await import("@/app/api/checkout/orders/[orderId]/route");
const { POST: payRoute } = await import("@/app/api/checkout/orders/[orderId]/pay/route");

let ana: { id: string };
let bruno: { id: string };

const signInAs = (user: { id: string } | null) => {
  session.current = user ? { user: { id: user.id, role: "USER" }, sessionVersion: 0 } : null;
};
const guest: Requester = { userId: null, access: null };
const as = (userId: string | null, access: CheckoutAccess | null = null): Requester => ({ userId, access });

const setStock = (id: string, stock: number) => testDb.product.update({ where: { id }, data: { stock } });
const input = (lines: PrepareOrderInput["lines"], confirmationTokenId = "ctoken_mock_visa"): PrepareOrderInput =>
  prepareOrderSchema.parse({ shipping, lines, confirmationTokenId });

/** A mock gateway whose calls are recorded. */
function spiedGateway() {
  const gateway = mockGateway();
  for (const key of Object.keys(gateway) as (keyof PaymentGateway)[]) vi.spyOn(gateway, key);
  return gateway;
}

/**
 * Holds the gateway's next call to `method` until released: lets a test
 * start a second request while the first one is inside Stripe's round trip.
 */
function pauseNext(gateway: PaymentGateway, method: "retrieveIntent" | "updateIntentAmount") {
  const original = gateway[method].bind(gateway) as (...args: unknown[]) => Promise<unknown>;
  let reached!: () => void;
  let release!: () => void;
  const reachedPromise = new Promise<void>((resolve) => (reached = resolve));
  const released = new Promise<void>((resolve) => (release = resolve));
  let paused = false;
  (gateway as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
    if (!paused) {
      paused = true;
      reached();
      await released;
    }
    return original(...args);
  };
  return { reached: reachedPromise, release };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function prepared(gateway: PaymentGateway, lines: PrepareOrderInput["lines"], requester = guest) {
  const outcome = await prepareOrder(testDb, gateway, input(lines), requester);
  if (!outcome.ok) throw new Error(`prepareOrder failed: ${outcome.code}`);
  return outcome;
}

beforeAll(async () => {
  await resetAndSeed();
  ana = await testDb.user.create({ data: { email: "ana@checkout.test", name: "Ana" } });
  bruno = await testDb.user.create({ data: { email: "bruno@checkout.test", name: "Bruno" } });
});

beforeEach(async () => {
  signInAs(null);
  await testDb.rateLimit.deleteMany();
  await Promise.all([setStock("5", 8), setStock("7", 40), setStock("11", 15)]);
});

describe("prepareOrder: the server prices the order", () => {
  it("takes prices from the database, adds shipping with lib/pricing, and opens an ARS PaymentIntent for the total", async () => {
    const gateway = spiedGateway();
    const { order, access } = await prepared(gateway, [
      { productId: "7", quantity: 1 },
      { productId: "5", quantity: 2 },
    ]);
    // Batmobile $2490 + 2 × Tusken Raider $189 = $2868, plus $299 shipping.
    expect(order).toMatchObject({ status: "PENDING", subtotal: 2868, shipping: 299, total: 3167, paymentBrand: "visa", paymentLast4: "4242" });
    expect(order.items).toEqual([
      expect.objectContaining({ productId: "7", name: "Batmobile", unitPrice: 2490, quantity: 1 }),
      expect.objectContaining({ productId: "5", unitPrice: 189, quantity: 2 }),
    ]);
    expect(order.email).toBe("ana@example.com");
    expect(order.shippingAddress.zipCode).toBe("C1043AAZ");
    expect(order.number).toBeGreaterThan(1000);

    expect(gateway.createIntent).toHaveBeenCalledWith({
      orderId: order.id,
      orderNumber: order.number,
      amount: 316_700,
      email: "ana@example.com",
      idempotencyKey: `order/${order.id}/intent`,
    });
    const row = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.stripePaymentIntentId).toMatch(/^pi_mock_/);
    expect(row.userId).toBeNull();
    expect(access?.orderId).toBe(order.id);
    expect(row.checkoutTokenHash).toBe(hashAccessToken(access!.token));
  });

  it("ships free from $5000", async () => {
    const gateway = mockGateway();
    expect((await prepared(gateway, [{ productId: "11", quantity: 1 }])).order).toMatchObject({ subtotal: 4999, shipping: 299, total: 5298 });
    expect((await prepared(gateway, [{ productId: "11", quantity: 1 }, { productId: "5", quantity: 1 }])).order).toMatchObject({
      subtotal: 5188,
      shipping: 0,
      total: 5188,
    });
  });

  it("refuses lines over the stock or of unknown products, and creates nothing", async () => {
    const before = await testDb.order.count();
    const outcome = await prepareOrder(
      testDb,
      mockGateway(),
      input([
        { productId: "5", quantity: 9 },
        { productId: "no-existe", quantity: 1 },
        { productId: "7", quantity: 1 },
      ]),
      guest
    );
    expect(outcome).toEqual({
      ok: false,
      code: "unavailable",
      unavailable: [
        { productId: "5", name: "Tusken Raider", available: 8 },
        { productId: "no-existe", name: null, available: 0 },
      ],
    });
    expect(await testDb.order.count()).toBe(before);
  });

  it("refuses a ConfirmationToken that does not exist", async () => {
    expect(await prepareOrder(testDb, mockGateway(), input([{ productId: "7", quantity: 1 }], "ctoken_mock_nope"), guest)).toEqual({
      ok: false,
      code: "payment_method",
    });
  });

  it("updates this browser's pending order (and its intent's amount) instead of opening another", async () => {
    const gateway = spiedGateway();
    const first = await prepared(gateway, [{ productId: "7", quantity: 1 }]);
    const second = await prepared(gateway, [{ productId: "7", quantity: 2 }], as(null, first.access));
    expect(second.order.id).toBe(first.order.id);
    expect(second.access).toBeNull();
    expect(second.order).toMatchObject({ subtotal: 4980, total: 5279 });
    expect(second.order.items).toHaveLength(1);
    const row = await testDb.order.findUniqueOrThrow({ where: { id: first.order.id } });
    expect(gateway.updateIntentAmount).toHaveBeenCalledWith(row.stripePaymentIntentId, 527_900);
    expect(gateway.createIntent).toHaveBeenCalledTimes(1);
  });

  it("a stolen or stale cookie does not reach someone else's order: a new one is opened", async () => {
    const gateway = mockGateway();
    const first = await prepared(gateway, [{ productId: "7", quantity: 1 }]);
    const forged = { orderId: first.order.id, token: "x".repeat(43) };
    const second = await prepared(gateway, [{ productId: "7", quantity: 1 }], as(null, forged));
    expect(second.order.id).not.toBe(first.order.id);
    expect((await testDb.order.findUniqueOrThrow({ where: { id: first.order.id } })).status).toBe("PENDING");
  });

  it("signing in mid-checkout opens an order on the account and cancels the guest one", async () => {
    const gateway = mockGateway();
    const first = await prepared(gateway, [{ productId: "7", quantity: 1 }]);
    const second = await prepared(gateway, [{ productId: "7", quantity: 1 }], as(ana.id, first.access));
    expect(second.order.id).not.toBe(first.order.id);
    expect(second.order.hasAccount).toBe(true);
    const old = await testDb.order.findUniqueOrThrow({ where: { id: first.order.id } });
    expect(old).toMatchObject({ status: "CANCELLED", cancelReason: "superseded" });
    expect((await gateway.retrieveIntent(old.stripePaymentIntentId!)).status).toBe("canceled");
  });
});

describe("payOrder", () => {
  it("confirms the intent with the token and marks the order as submitted (PAID comes with the webhook)", async () => {
    const gateway = spiedGateway();
    const { order, access } = await prepared(gateway, [{ productId: "7", quantity: 1 }]);
    const outcome = await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", as(null, access));
    expect(outcome).toMatchObject({ ok: true, next: "done", order: { id: order.id, status: "PENDING" } });
    const row = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.submittedAt).not.toBeNull();
    expect(gateway.confirmIntent).toHaveBeenCalledWith(row.stripePaymentIntentId, "ctoken_mock_visa", `order/${order.id}/confirm/ctoken_mock_visa`);
    expect((await gateway.retrieveIntent(row.stripePaymentIntentId!)).status).toBe("succeeded");
    // A second click finds it paid: nothing is charged again.
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", as(null, access))).toMatchObject({ ok: true, next: "done" });
    expect(gateway.confirmIntent).toHaveBeenCalledTimes(1);
  });

  it("a declined card leaves the order pending, payable with another card, and out of Mis pedidos meanwhile", async () => {
    const gateway = mockGateway();
    const { order } = await prepared(gateway, [{ productId: "7", quantity: 1 }], as(ana.id));
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_declined", as(ana.id))).toMatchObject({
      ok: false,
      code: "declined",
      message: expect.stringContaining("rechazó"),
    });
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_insufficient", as(ana.id))).toMatchObject({
      code: "declined",
      message: expect.stringContaining("fondos"),
    });
    // Refused cards are no purchase: nothing to wait for in Mis pedidos.
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).submittedAt).toBeNull();
    expect((await listUserOrders(testDb, ana.id)).map((listed) => listed.id)).not.toContain(order.id);
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", as(ana.id))).toMatchObject({ ok: true });
    expect((await listUserOrders(testDb, ana.id)).map((listed) => listed.id)).toContain(order.id);
  });

  it("does not charge when the stock is already gone", async () => {
    const gateway = spiedGateway();
    const { order, access } = await prepared(gateway, [{ productId: "5", quantity: 3 }]);
    await setStock("5", 2);
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", as(null, access))).toEqual({
      ok: false,
      code: "unavailable",
      unavailable: [{ productId: "5", name: "Tusken Raider", available: 2 }],
    });
    expect(gateway.confirmIntent).not.toHaveBeenCalled();
  });

  it("only the order's browser or owner can pay it", async () => {
    const gateway = mockGateway();
    const { order } = await prepared(gateway, [{ productId: "7", quantity: 1 }], as(ana.id));
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", as(bruno.id))).toEqual({ ok: false, code: "not_found" });
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", guest)).toEqual({ ok: false, code: "not_found" });
    expect(await payOrder(testDb, gateway, order.id, "ctoken_mock_visa", as(ana.id))).toMatchObject({ ok: true });
  });
});

describe("paying and re-preparing the same order at once", () => {
  /** What Stripe charged and what the order holds must agree, whoever wins. */
  async function chargedMatchesOrder(gateway: PaymentGateway, orderId: string) {
    const row = await testDb.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const intent = await gateway.retrieveIntent(row.stripePaymentIntentId!);
    return { row, intent, matches: intent.amount === toCentavos(row.total) };
  }

  it("a re-prepare that arrives while the payment is with Stripe waits, and opens a new order", async () => {
    const gateway = mockGateway();
    const first = await prepared(gateway, [{ productId: "5", quantity: 1 }]);
    const pause = pauseNext(gateway, "retrieveIntent");
    const paying = payOrder(testDb, gateway, first.order.id, "ctoken_mock_visa", as(null, first.access));
    await pause.reached; // payOrder holds the order, mid round trip.
    const reprepare = prepareOrder(testDb, gateway, input([{ productId: "7", quantity: 20 }]), as(null, first.access));
    await settle(300);
    pause.release();
    const [paid, again] = await Promise.all([paying, reprepare]);

    expect(paid).toMatchObject({ ok: true, next: "done" });
    expect(again.ok && again.order.id).not.toBe(first.order.id);
    const { row, intent, matches } = await chargedMatchesOrder(gateway, first.order.id);
    expect(intent.status).toBe("succeeded");
    expect(matches).toBe(true);
    expect(row.total).toBe(488);
    expect(row.items.map((item) => [item.productId, item.quantity])).toEqual([["5", 1]]);
  });

  it("a payment that arrives while a re-prepare is with Stripe waits, and pays the new total", async () => {
    const gateway = mockGateway();
    const first = await prepared(gateway, [{ productId: "5", quantity: 1 }]);
    const pause = pauseNext(gateway, "updateIntentAmount");
    const reprepare = prepareOrder(testDb, gateway, input([{ productId: "7", quantity: 20 }]), as(null, first.access));
    await pause.reached; // prepareOrder holds the order, changing the amount at Stripe.
    const paying = payOrder(testDb, gateway, first.order.id, "ctoken_mock_visa", as(null, first.access));
    await settle(300);
    pause.release();
    const [again, paid] = await Promise.all([reprepare, paying]);

    expect(again).toMatchObject({ ok: true, order: { id: first.order.id, total: 49_800 } });
    expect(paid).toMatchObject({ ok: true, next: "done" });
    const { row, intent, matches } = await chargedMatchesOrder(gateway, first.order.id);
    expect(intent.status).toBe("succeeded");
    expect(matches).toBe(true);
    expect(row.items.map((item) => [item.productId, item.quantity])).toEqual([["7", 20]]);
  });

  it("a re-prepare after the payment went through leaves the paid order as it was", async () => {
    const gateway = mockGateway();
    const first = await prepared(gateway, [{ productId: "5", quantity: 1 }]);
    await payOrder(testDb, gateway, first.order.id, "ctoken_mock_visa", as(null, first.access));
    const again = await prepareOrder(testDb, gateway, input([{ productId: "7", quantity: 20 }]), as(null, first.access));
    expect(again.ok && again.order.id).not.toBe(first.order.id);
    const { row, matches } = await chargedMatchesOrder(gateway, first.order.id);
    expect(matches).toBe(true);
    expect(row).toMatchObject({ status: "PENDING", total: 488 });
  });
});

describe("checkout Route Handlers", () => {
  const body = (lines = [{ productId: "7", quantity: 1 }]) => ({ shipping, lines, confirmationTokenId: "ctoken_mock_visa" });

  it("POST /api/checkout/orders prices on the server, ignores client prices and sets an HttpOnly cookie", async () => {
    const response = await prepareRoute(
      jsonRequest("/api/checkout/orders", { ...body([{ productId: "7", quantity: 1, price: 1 } as never]), total: 1 })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const { order } = await response.json();
    expect(order).toMatchObject({ total: 2789, status: "PENDING" });
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    expect(cookieOf(response)).toMatch(new RegExp(`^${order.id}\\.`));
  });

  it("rejects bad input, cross-site posts and unconfigured payments", async () => {
    expect((await prepareRoute(jsonRequest("/api/checkout/orders", { ...body(), lines: [] }))).status).toBe(400);
    expect((await prepareRoute(jsonRequest("/api/checkout/orders", body(), { origin: "https://evil.example" }))).status).toBe(403);
    const conflict = await prepareRoute(jsonRequest("/api/checkout/orders", body([{ productId: "5", quantity: 50 }])));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: "unavailable", unavailable: [{ productId: "5", available: 8 }] });

    delete process.env.STRIPE_MOCK;
    try {
      const response = await prepareRoute(jsonRequest("/api/checkout/orders", body()));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "payments_unconfigured" });
    } finally {
      enableMockPayments();
    }
  });

  it("GET /api/checkout/orders/<id> answers its browser and its owner, and 404 to anyone else", async () => {
    signInAs(ana);
    const response = await prepareRoute(jsonRequest("/api/checkout/orders", body()));
    const { order } = await response.json();
    const cookie = cookieOf(response)!;
    const read = (options: { cookie?: string | null }) =>
      orderRoute(getRequest(`/api/checkout/orders/${order.id}`, options), { params: Promise.resolve({ orderId: order.id }) });

    expect((await read({ cookie })).status).toBe(200);
    expect((await read({})).status).toBe(200); // Ana, signed in, without the cookie.
    signInAs(bruno);
    expect((await read({})).status).toBe(404);
    expect((await read({ cookie: serializeCheckoutCookie({ orderId: order.id, token: "y".repeat(43) }) })).status).toBe(404);
    signInAs(null);
    expect((await read({})).status).toBe(404);
    // Signed out in the same browser: an account's order needs the account; the dead cookie is deleted.
    const signedOut = await read({ cookie });
    expect(signedOut.status).toBe(404);
    expect(signedOut.headers.get("set-cookie")).toMatch(/lego-checkout=;.*Expires=Thu, 01 Jan 1970/i);
  });

  it("a guest's cookie opens its order while it is pending and briefly after it is paid", async () => {
    const response = await prepareRoute(jsonRequest("/api/checkout/orders", body()));
    const { order } = await response.json();
    const cookie = cookieOf(response)!;
    const read = () => orderRoute(getRequest(`/api/checkout/orders/${order.id}`, { cookie }), { params: Promise.resolve({ orderId: order.id }) });

    expect((await read()).status).toBe(200);
    await testDb.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    expect((await read()).status).toBe(200); // The confirmation polling it.
    await testDb.order.update({ where: { id: order.id }, data: { paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    expect((await read()).status).toBe(404); // Hours later, at a shared computer.
  });

  it("POST …/pay confirms the payment for the order's browser only", async () => {
    const created = await prepareRoute(jsonRequest("/api/checkout/orders", body()));
    const { order } = await created.json();
    const cookie = cookieOf(created)!;
    const pay = (cookie: string | null, token = "ctoken_mock_visa") =>
      payRoute(jsonRequest(`/api/checkout/orders/${order.id}/pay`, { confirmationTokenId: token }, { cookie }), {
        params: Promise.resolve({ orderId: order.id }),
      });

    expect((await pay(null)).status).toBe(404);
    const declined = await pay(cookie, "ctoken_mock_declined");
    expect(declined.status).toBe(402);
    expect(await declined.json()).toMatchObject({ code: "declined" });
    const paid = await pay(cookie);
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({ next: "done", order: { id: order.id } });
    const row = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect((await getPaymentGateway()!.retrieveIntent(row.stripePaymentIntentId!)).status).toBe("succeeded");
  });
});

describe("account order queries", () => {
  it("list only the user's own submitted orders and never show anyone else's", async () => {
    const gateway = mockGateway();
    const abandoned = await prepared(gateway, [{ productId: "7", quantity: 1 }], as(bruno.id));
    // Another browser (no cookie of the first): a second order.
    const placed = await prepared(
      gateway,
      [
        { productId: "5", quantity: 1 },
        { productId: "7", quantity: 3 },
      ],
      as(bruno.id)
    );
    await payOrder(testDb, gateway, placed.order.id, "ctoken_mock_visa", as(bruno.id));
    const single = await prepared(gateway, [{ productId: "11", quantity: 3 }], as(bruno.id));
    await payOrder(testDb, gateway, single.order.id, "ctoken_mock_visa", as(bruno.id));
    // "Revisar" an hour before "Realizar pedido": the order dates from the latter.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await testDb.order.update({ where: { id: single.order.id }, data: { createdAt: hourAgo } });

    const listed = await listUserOrders(testDb, bruno.id);
    expect(listed.map((order) => order.id)).toContain(placed.order.id);
    expect(listed.map((order) => order.id)).not.toContain(abandoned.order.id);
    // Newest placed first.
    expect(listed.map((order) => order.id).slice(0, 2)).toEqual([single.order.id, placed.order.id]);
    expect(listed.find((order) => order.id === placed.order.id)).toMatchObject({ lineCount: 2, itemCount: 4, firstItemName: "Tusken Raider" });
    // Three units of one product are one product.
    const singleRow = listed.find((order) => order.id === single.order.id)!;
    expect(singleRow).toMatchObject({ lineCount: 1, itemCount: 3 });
    const submittedAt = (await testDb.order.findUniqueOrThrow({ where: { id: single.order.id } })).submittedAt!;
    expect(singleRow.placedAt).toBe(submittedAt.toISOString());
    expect(new Date(singleRow.placedAt).getTime()).toBeGreaterThan(hourAgo.getTime());

    expect(await getUserOrder(testDb, bruno.id, placed.order.id)).toMatchObject({ id: placed.order.id });
    expect(await getUserOrder(testDb, ana.id, placed.order.id)).toBeNull();
    expect(await getCheckoutOrder(testDb, placed.order.id, as(ana.id))).toBeNull();
    expect((await listUserOrders(testDb, ana.id)).map((order) => order.id)).not.toContain(placed.order.id);
  });
});

describe("expireStaleOrders", () => {
  it("cancels day-old pending orders and their intents; keeps fresh ones and ones whose payment went through", async () => {
    const gateway = mockGateway();
    const stale = await prepared(gateway, [{ productId: "7", quantity: 1 }]);
    const paying = await prepared(gateway, [{ productId: "7", quantity: 1 }]);
    const fresh = await prepared(gateway, [{ productId: "7", quantity: 1 }]);
    await payOrder(testDb, gateway, paying.order.id, "ctoken_mock_visa", as(null, paying.access));
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await testDb.$executeRaw`UPDATE "Order" SET "updatedAt" = ${old} WHERE "id" IN (${stale.order.id}, ${paying.order.id})`;

    const result = await expireStaleOrders(testDb, gateway);
    expect(result.expired).toBeGreaterThanOrEqual(1);
    const rows = await testDb.order.findMany({ where: { id: { in: [stale.order.id, paying.order.id, fresh.order.id] } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(stale.order.id)).toMatchObject({ status: "CANCELLED", cancelReason: "expired" });
    expect((await gateway.retrieveIntent(byId.get(stale.order.id)!.stripePaymentIntentId!)).status).toBe("canceled");
    expect(byId.get(paying.order.id)!.status).toBe("PENDING");
    expect(byId.get(fresh.order.id)!.status).toBe("PENDING");
  });
});
