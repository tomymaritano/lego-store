import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { changeOrderStatus, getAdminOrder } from "@/lib/admin/orders";
import { serializeCheckoutCookie, type Requester } from "@/lib/orders/access";
import { expireStaleOrders } from "@/lib/orders/expire";
import { applyMercadoPagoPayment, payMercadoPagoOrder, prepareMercadoPagoOrder } from "@/lib/orders/mercadopago";
import { getMercadoPago, getMercadoPagoMockControls } from "@/lib/payments/config";
import { mpMockToken, type MpMockCardId } from "@/lib/payments/mercadopago/mock-options";
import type { MercadoPagoClient } from "@/lib/payments/mercadopago/types";
import { prepareMercadoPagoOrderSchema, type PayMercadoPagoOrderInput } from "@/lib/validations/orders";
import { resetAndSeed, testDb } from "./setup/db";
import { cookieOf, enableMockPayments, jsonRequest, mercadoPagoNotification, shipping } from "./setup/checkout";

/*
 * Mercado Pago orders against the test database, with the in-memory Mercado
 * Pago (the boundary) and notifications signed with the test secret, through
 * the real Route Handlers where it matters: the server's total is what is
 * charged; approved, pending (cash tickets, cards under review), rejected,
 * cancelled, refunded and charged-back payments; the webhook's signature,
 * idempotency and late or repeated notifications; the race for the last
 * unit; refunds from the admin through the order's provider; Checkout Pro
 * (account money) and the return sync; and the cleanup of lapsed payments.
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});

enableMockPayments({ provider: "mercadopago" });

const { POST: prepareRoute } = await import("@/app/api/checkout/orders/route");
const { POST: payRoute } = await import("@/app/api/checkout/orders/[orderId]/pay/route");
const { POST: syncRoute } = await import("@/app/api/checkout/orders/[orderId]/sync/route");
const { POST: webhook } = await import("@/app/api/webhooks/mercadopago/route");

let mp: MercadoPagoClient;
const controls = () => getMercadoPagoMockControls()!;
let ana: { id: string };
let admin: { id: string; email: string };

const guest: Requester = { userId: null, access: null };
const stockOf = async (id: string) => (await testDb.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock;
const setStock = (id: string, stock: number) => testDb.product.update({ where: { id }, data: { stock } });
const orderRow = (id: string) => testDb.order.findUniqueOrThrow({ where: { id }, include: { paymentEvents: { orderBy: { createdAt: "asc" } } } });

let emails: { mock: { calls: unknown[][] }; mockRestore: () => void };
const sentEmails = () => emails.mock.calls.map((call) => String(call[0])).filter((text) => text.startsWith("\n[email]"));

async function prepared(lines: { productId: string; quantity: number }[], requester: Requester = guest) {
  const outcome = await prepareMercadoPagoOrder(
    testDb,
    { stripe: null, mercadopago: mp },
    prepareMercadoPagoOrderSchema.parse({ shipping, lines, provider: "MERCADOPAGO" }),
    requester
  );
  if (!outcome.ok) throw new Error(`prepare failed: ${outcome.code}`);
  return { order: outcome.order, requester: { userId: requester.userId, access: outcome.access ?? requester.access } };
}

const card = (scenario: MpMockCardId, installments = 1): PayMercadoPagoOrderInput => ({
  attemptId: randomUUID(),
  method: "card",
  formData: { token: mpMockToken(scenario), payment_method_id: "visa", installments, payer: { email: "ana@example.com" } },
});
const cash = (method = "rapipago"): PayMercadoPagoOrderInput => ({ attemptId: randomUUID(), method: "ticket", formData: { payment_method_id: method } });

async function pay(orderId: string, input: PayMercadoPagoOrderInput, requester: Requester) {
  return payMercadoPagoOrder(testDb, mp, orderId, input, requester);
}

/** A pending cash order (PAYMENT_PENDING) and its payment id. */
async function ticketOrder(lines: { productId: string; quantity: number }[]) {
  const { order, requester } = await prepared(lines);
  const outcome = await pay(order.id, cash(), requester);
  if (!outcome.ok) throw new Error(outcome.code);
  const row = await orderRow(order.id);
  return { id: order.id, paymentId: row.providerPaymentId!, requester };
}

const notify = async (paymentId: string) => {
  const response = await webhook(mercadoPagoNotification(paymentId));
  return { status: response.status, body: (await response.json()) as { result?: string } };
};

beforeAll(async () => {
  await resetAndSeed();
  mp = getMercadoPago()!;
  ana = await testDb.user.create({ data: { email: "ana@mp.test", name: "Ana" } });
  admin = await testDb.user.create({ data: { email: "admin@mp.test", name: "Admin", role: "ADMIN" } });
});

beforeEach(async () => {
  session.current = null;
  emails = vi.spyOn(console, "info").mockImplementation(() => {});
  await testDb.rateLimit.deleteMany();
  await Promise.all([setStock("5", 8), setStock("7", 40), setStock("11", 15)]);
});

afterEach(() => emails.mockRestore());

describe("prepare and pay", () => {
  it("prices from the database and charges the order's total, whatever the browser says, with an idempotency key per attempt", async () => {
    const { order, requester } = await prepared([
      { productId: "7", quantity: 1 },
      { productId: "5", quantity: 2 },
    ]);
    expect(order).toMatchObject({ status: "PENDING", total: 3167, payment: { provider: "MERCADOPAGO", methodType: null } });

    const create = vi.spyOn(mp, "createPayment");
    const input = card("approved");
    const outcome = await pay(order.id, { ...input, formData: { ...input.formData!, transaction_amount: 1 } as never }, requester);
    expect(outcome).toMatchObject({ ok: true, next: "done", order: { status: "PAID" } });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ transaction_amount: 3167, external_reference: order.id, token: mpMockToken("approved"), payment_method_id: "visa" }),
      `order/${order.id}/mp/${input.attemptId}`
    );
    create.mockRestore();

    const row = await orderRow(order.id);
    expect(row).toMatchObject({
      status: "PAID",
      paymentProvider: "MERCADOPAGO",
      paymentStatus: "approved",
      paymentMethodType: "credit_card",
      paymentBrand: "visa",
      paymentLast4: "3704",
      installments: 1,
    });
    expect(row.paidAt).not.toBeNull();
    expect(row.submittedAt).not.toBeNull();
    expect(row.paymentEvents.map((event) => [event.status, event.source])).toEqual([["approved", "checkout"]]);
    expect(await stockOf("5")).toBe(6);
    expect(await stockOf("7")).toBe(39);
  });

  it("through the routes: the pay route emails the confirmation and clears the account's cart", async () => {
    session.current = { user: { id: ana.id, role: "USER" }, sessionVersion: 0 };
    await testDb.cartItem.createMany({ data: [{ userId: ana.id, productId: "11", quantity: 1 }, { userId: ana.id, productId: "7", quantity: 2 }] });
    const prepare = await prepareRoute(jsonRequest("/api/checkout/orders", { shipping, lines: [{ productId: "11", quantity: 1 }], provider: "MERCADOPAGO" }));
    expect(prepare.status).toBe(200);
    const cookie = cookieOf(prepare);
    const { order } = await prepare.json();
    const response = await payRoute(jsonRequest(`/api/checkout/orders/${order.id}/pay`, { mercadopago: card("installments", 3) }, { cookie }), {
      params: Promise.resolve({ orderId: order.id }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ next: "done", order: { status: "PAID", payment: { installments: 3 } } });
    expect(sentEmails().some((text) => text.includes("Confirmamos tu pedido"))).toBe(true);
    expect(await testDb.cartItem.findMany({ where: { userId: ana.id }, select: { productId: true } })).toEqual([{ productId: "7" }]);
    await testDb.cartItem.deleteMany({ where: { userId: ana.id } });
  });

  it("a Stripe-shaped request is refused while the store takes Mercado Pago (the payment step is stale)", async () => {
    const response = await prepareRoute(
      jsonRequest("/api/checkout/orders", { shipping, lines: [{ productId: "11", quantity: 1 }], confirmationTokenId: "ctoken_mock_visa" })
    );
    expect(response.status).toBe(422);
  });

  it("a rejected card keeps the order pending, out of 'Mis pedidos', with the reason; another card then pays it", async () => {
    const { order, requester } = await prepared([{ productId: "11", quantity: 1 }]);
    const declined = await pay(order.id, card("insufficient"), requester);
    expect(declined).toEqual({ ok: false, code: "declined", message: expect.stringContaining("fondos suficientes") });
    let row = await orderRow(order.id);
    expect(row).toMatchObject({ status: "PENDING", submittedAt: null, paymentStatus: "rejected" });
    expect(await stockOf("11")).toBe(15);

    // A retried request with the same attempt is the same rejected payment, not a new charge.
    const again = card("insufficient");
    await pay(order.id, again, requester);
    expect(await pay(order.id, again, requester)).toMatchObject({ ok: false, code: "declined" });

    expect(await pay(order.id, card("approved"), requester)).toMatchObject({ ok: true, order: { status: "PAID" } });
    row = await orderRow(order.id);
    expect(row.status).toBe("PAID");
    expect(await stockOf("11")).toBe(14);
  });

  it("an unusable card token asks for the payment data again", async () => {
    const { order, requester } = await prepared([{ productId: "11", quantity: 1 }]);
    const outcome = await pay(order.id, { ...card("approved"), formData: { token: "mp_mock_nope_123", payment_method_id: "visa" } }, requester);
    expect(outcome).toMatchObject({ ok: false, code: "payment_method" });
  });

  it("only the order's browser can pay it, and only while it is pending", async () => {
    const { order, requester } = await prepared([{ productId: "11", quantity: 1 }]);
    expect(await pay(order.id, card("approved"), guest)).toEqual({ ok: false, code: "not_found" });
    await pay(order.id, card("approved"), requester);
    expect(await pay(order.id, card("approved"), requester)).toMatchObject({ ok: false, code: "not_pending" });
  });
});

describe("pending payments", () => {
  it("a cash ticket leaves the order PAYMENT_PENDING with its link and expiry, emails the instructions, and takes no stock", async () => {
    const { order, requester } = await prepared([{ productId: "5", quantity: 1 }]);
    const response = await payRoute(
      jsonRequest(`/api/checkout/orders/${order.id}/pay`, { mercadopago: cash("pagofacil") }, { cookie: serializeCheckoutCookie(requester.access!) }),
      { params: Promise.resolve({ orderId: order.id }) }
    );
    expect(response.status).toBe(200);
    const { order: view } = await response.json();
    expect(view).toMatchObject({ status: "PAYMENT_PENDING", payment: { methodType: "ticket", ticketUrl: expect.stringContaining("ticket") } });
    expect(view.payment.ticketExpiresAt).not.toBeNull();
    expect(view.submittedAt).not.toBeNull();
    expect(await stockOf("5")).toBe(8);
    expect(sentEmails().some((text) => text.includes("espera el pago") && text.includes("Pago Fácil"))).toBe(true);
  });

  it("paid at the counter: the signed notification marks it PAID; repeats and late news change nothing", async () => {
    const { id, paymentId } = await ticketOrder([{ productId: "5", quantity: 2 }]);
    controls().setStatus(paymentId, "approved", "accredited");
    expect(await notify(paymentId)).toEqual({ status: 200, body: { received: true, result: "paid" } });
    expect((await orderRow(id)).status).toBe("PAID");
    expect(await stockOf("5")).toBe(6);
    expect(sentEmails().some((text) => text.includes("Confirmamos tu pedido"))).toBe(true);

    // Mercado Pago retries, or sends payment.created after payment.updated: the payment is read again and is still approved.
    expect((await notify(paymentId)).body.result).toBe("duplicate");
    expect(await stockOf("5")).toBe(6);
    const events = (await orderRow(id)).paymentEvents.map((event) => [event.status, event.source]);
    expect(events).toEqual([
      ["pending", "checkout"],
      ["approved", "webhook"],
    ]);
  });

  it("a ticket that expires unpaid cancels the order and tells the customer; nothing was taken", async () => {
    const { id, paymentId } = await ticketOrder([{ productId: "5", quantity: 1 }]);
    controls().setStatus(paymentId, "cancelled", "expired");
    expect((await notify(paymentId)).body.result).toBe("cancelled");
    expect(await orderRow(id)).toMatchObject({ status: "CANCELLED", cancelReason: "expired" });
    expect(await stockOf("5")).toBe(8);
    expect(sentEmails().some((text) => text.includes("No se acreditó el pago"))).toBe(true);
  });

  it("a card under review waits, then a rejection cancels the order", async () => {
    const { order, requester } = await prepared([{ productId: "11", quantity: 1 }]);
    expect(await pay(order.id, card("review"), requester)).toMatchObject({ ok: true, order: { status: "PAYMENT_PENDING" } });
    const { providerPaymentId } = await orderRow(order.id);
    controls().setStatus(providerPaymentId!, "rejected", "cc_rejected_high_risk");
    expect((await notify(providerPaymentId!)).body.result).toBe("cancelled");
    expect(await orderRow(order.id)).toMatchObject({ status: "CANCELLED", cancelReason: "payment_rejected" });
  });

  it("news about an older attempt never moves the order", async () => {
    const { order, requester } = await prepared([{ productId: "11", quantity: 1 }]);
    await pay(order.id, card("rejected"), requester);
    const rejected = (await orderRow(order.id)).providerPaymentId!;
    await pay(order.id, card("approved"), requester);
    // The rejected attempt's notification arrives last.
    expect((await notify(rejected)).body.result).toBe("duplicate");
    expect((await orderRow(order.id)).status).toBe("PAID");
  });
});

describe("the webhook", () => {
  it("refuses an unsigned or wrongly signed notification, and ignores what is not a known payment", async () => {
    const { paymentId } = await ticketOrder([{ productId: "5", quantity: 1 }]);
    expect((await webhook(mercadoPagoNotification(paymentId, { secret: "another" }))).status).toBe(401);
    const unsigned = mercadoPagoNotification(paymentId);
    unsigned.headers.delete("x-signature");
    expect((await webhook(unsigned)).status).toBe(401);
    expect(await notify("123456789999")).toEqual({ status: 200, body: { received: true, result: "ignored" } });
    const other = await webhook(mercadoPagoNotification("42", { type: "merchant_order" }));
    expect(await other.json()).toEqual({ received: true, result: "ignored" });
  });

  it("two buyers race for the last unit: one order is paid, the other is refunded and cancelled", async () => {
    await setStock("5", 1);
    const first = await ticketOrder([{ productId: "5", quantity: 1 }]);
    const second = await ticketOrder([{ productId: "5", quantity: 1 }]);
    controls().setStatus(first.paymentId, "approved", "accredited");
    controls().setStatus(second.paymentId, "approved", "accredited");
    const results = await Promise.all([notify(first.paymentId), notify(second.paymentId)]);
    expect(results.map((result) => result.body.result).sort()).toEqual(["out_of_stock", "paid"]);
    expect(await stockOf("5")).toBe(0);
    const loser = results[0]!.body.result === "out_of_stock" ? first : second;
    expect(await orderRow(loser.id)).toMatchObject({ status: "CANCELLED", cancelReason: "out_of_stock", providerRefundId: expect.any(String) });
    expect(controls().get(loser.paymentId)?.status).toBe("refunded");
  });

  it("a charge for another amount is refunded and the order cancelled", async () => {
    const { order } = await prepared([{ productId: "11", quantity: 1 }]);
    const stray = controls().addPayment({
      id: "777000111",
      status: "approved",
      statusDetail: "accredited",
      externalReference: order.id,
      amount: order.total - 100,
      currency: "ARS",
      paymentMethodId: "visa",
      paymentTypeId: "credit_card",
      installments: 1,
      lastFourDigits: "3704",
      ticketUrl: null,
      expiresAt: null,
      refunds: [],
    });
    expect((await notify(stray.id)).body.result).toBe("amount_mismatch");
    expect(await orderRow(order.id)).toMatchObject({ status: "CANCELLED", cancelReason: "amount_mismatch" });
    expect(controls().get(stray.id)?.status).toBe("refunded");
    expect(await stockOf("11")).toBe(15);
  });

  it("a refund made in Mercado Pago cancels a paid order and puts the stock back; a chargeback too", async () => {
    const refunded = await ticketOrder([{ productId: "7", quantity: 2 }]);
    controls().setStatus(refunded.paymentId, "approved", "accredited");
    await notify(refunded.paymentId);
    expect(await stockOf("7")).toBe(38);
    await mp.refundPayment(refunded.paymentId, { idempotencyKey: `dashboard/${refunded.paymentId}` });
    expect((await notify(refunded.paymentId)).body.result).toBe("refund_cancelled");
    expect(await orderRow(refunded.id)).toMatchObject({ status: "CANCELLED", cancelReason: "refunded", providerRefundId: expect.any(String) });
    expect(await stockOf("7")).toBe(40);

    const disputed = await ticketOrder([{ productId: "7", quantity: 1 }]);
    controls().setStatus(disputed.paymentId, "approved", "accredited");
    await notify(disputed.paymentId);
    controls().setStatus(disputed.paymentId, "charged_back", "settled");
    expect((await notify(disputed.paymentId)).body.result).toBe("chargeback");
    expect(await orderRow(disputed.id)).toMatchObject({ status: "CANCELLED", cancelReason: "chargeback" });
    expect(await stockOf("7")).toBe(40);
  });

  it("a payment approved after its order was cancelled goes back to the customer", async () => {
    const { order } = await prepared([{ productId: "11", quantity: 1 }]);
    await testDb.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "expired" } });
    const late = controls().addPayment({
      id: "777000222",
      status: "approved",
      statusDetail: "accredited",
      externalReference: order.id,
      amount: order.total,
      currency: "ARS",
      paymentMethodId: "rapipago",
      paymentTypeId: "ticket",
      installments: 1,
      lastFourDigits: null,
      ticketUrl: null,
      expiresAt: null,
      refunds: [],
    });
    expect(await applyMercadoPagoPayment(testDb, mp, late, "webhook")).toEqual({ result: "refunded", orderId: order.id, notify: true });
    expect(controls().get(late.id)?.status).toBe("refunded");
    expect(await orderRow(order.id)).toMatchObject({ status: "CANCELLED", cancelReason: "refunded" });
    expect(await stockOf("11")).toBe(15);
  });
});

describe("admin", () => {
  const actor = () => ({ id: admin.id, email: admin.email });

  it("cancelling a paid order refunds it through Mercado Pago, puts the stock back, and records it; the refund's notification changes nothing", async () => {
    const { order, requester } = await prepared([{ productId: "7", quantity: 3 }]);
    await pay(order.id, card("approved"), requester);
    expect(await stockOf("7")).toBe(37);
    const result = await changeOrderStatus(testDb, { stripe: null, mercadopago: mp }, { orderId: order.id, to: "CANCELLED", expected: "PAID" }, actor());
    expect(result).toMatchObject({ ok: true, changed: true, status: "CANCELLED", restockedProductIds: ["7"], refundId: expect.any(String) });
    expect(await stockOf("7")).toBe(40);
    const view = await getAdminOrder(testDb, order.id);
    expect(view).toMatchObject({ paymentId: expect.any(String), refundId: result.ok ? result.refundId : null, payment: { provider: "MERCADOPAGO" } });
    expect(view!.history).toEqual([expect.objectContaining({ from: "PAID", to: "CANCELLED", refundId: result.ok ? result.refundId : null })]);
    expect(controls().get(view!.paymentId!)?.status).toBe("refunded");

    expect((await notify(view!.paymentId!)).body.result).toBe("unchanged");
    expect(await stockOf("7")).toBe(40);
    expect((await getAdminOrder(testDb, order.id))!.paymentEvents.map((event) => event.status)).toEqual(["approved", "refunded"]);
  });

  it("cancelling an order waiting for its ticket cancels the payment in Mercado Pago", async () => {
    const { id, paymentId } = await ticketOrder([{ productId: "5", quantity: 1 }]);
    const result = await changeOrderStatus(testDb, { stripe: null, mercadopago: mp }, { orderId: id, to: "CANCELLED", expected: "PAYMENT_PENDING" }, actor());
    expect(result).toMatchObject({ ok: true, changed: true, status: "CANCELLED" });
    expect(controls().get(paymentId)?.status).toBe("cancelled");
    // Mercado Pago then notifies the cancellation: the order already is.
    expect((await notify(paymentId)).body.result).toBe("unchanged");
  });

  it("refuses to cancel a pending order whose payment went through meanwhile", async () => {
    const { id, paymentId } = await ticketOrder([{ productId: "5", quantity: 1 }]);
    controls().setStatus(paymentId, "approved", "accredited");
    const result = await changeOrderStatus(testDb, { stripe: null, mercadopago: mp }, { orderId: id, to: "CANCELLED", expected: "PAYMENT_PENDING" }, actor());
    expect(result).toEqual({ ok: false, reason: "payment_in_flight" });
    expect((await orderRow(id)).status).toBe("PAYMENT_PENDING");
  });

  it("without Mercado Pago configured, a Mercado Pago refund is refused and nothing changes", async () => {
    const { order, requester } = await prepared([{ productId: "11", quantity: 1 }]);
    await pay(order.id, card("approved"), requester);
    const result = await changeOrderStatus(testDb, { stripe: null, mercadopago: null }, { orderId: order.id, to: "CANCELLED", expected: "PAID" }, actor());
    expect(result).toEqual({ ok: false, reason: "payments_unconfigured" });
    expect((await orderRow(order.id)).status).toBe("PAID");
  });
});

describe("account money (Checkout Pro)", () => {
  it("'Realizar pedido' opens a preference for the order's total and comes back; the return syncs the payment", async () => {
    const { order, requester } = await prepared([{ productId: "11", quantity: 2 }]);
    const wallet: PayMercadoPagoOrderInput = { attemptId: randomUUID(), method: "wallet" };
    const outcome = await pay(order.id, wallet, requester);
    if (!outcome.ok || outcome.next !== "redirect") throw new Error("expected a redirect");
    const preferenceId = new URL(outcome.url).searchParams.get("preference_id")!;
    expect(controls().preference(preferenceId)?.request).toMatchObject({
      external_reference: order.id,
      items: [expect.objectContaining({ quantity: 1, unit_price: order.total, currency_id: "ARS" })],
      back_urls: { success: expect.stringContaining(`/checkout/pedido/${order.id}`) },
    });
    // A second click opens the same preference.
    expect(await pay(order.id, wallet, requester)).toMatchObject({ ok: true, next: "redirect", url: outcome.url });

    const payment = controls().payPreference(preferenceId);
    const cookie = serializeCheckoutCookie(requester.access!);
    // Someone else's payment id in the return URL is not this order's: ignored.
    const foreign = await syncRoute(jsonRequest(`/api/checkout/orders/${order.id}/sync`, { paymentId: "123" }, { cookie }), {
      params: Promise.resolve({ orderId: order.id }),
    });
    expect((await foreign.json()).order.status).toBe("PENDING");
    const synced = await syncRoute(jsonRequest(`/api/checkout/orders/${order.id}/sync`, { paymentId: payment.id }, { cookie }), {
      params: Promise.resolve({ orderId: order.id }),
    });
    expect(synced.status).toBe(200);
    expect((await synced.json()).order).toMatchObject({ status: "PAID", payment: { methodType: "account_money" } });
    expect(await stockOf("11")).toBe(13);
    // The webhook that follows finds it done.
    expect((await notify(payment.id)).body.result).toBe("duplicate");
  });

  it("the sync is only for the order's browser", async () => {
    const { order } = await prepared([{ productId: "11", quantity: 1 }]);
    const response = await syncRoute(jsonRequest(`/api/checkout/orders/${order.id}/sync`, {}), { params: Promise.resolve({ orderId: order.id }) });
    expect(response.status).toBe(404);
  });
});

describe("cleanup", () => {
  it("cancels tickets that expired a while ago with Mercado Pago, and settles one that was paid but never notified", async () => {
    const lapsed = await ticketOrder([{ productId: "5", quantity: 1 }]);
    const paid = await ticketOrder([{ productId: "5", quantity: 1 }]);
    const fresh = await ticketOrder([{ productId: "5", quantity: 1 }]);
    const longAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await testDb.order.updateMany({ where: { id: { in: [lapsed.id, paid.id] } }, data: { ticketExpiresAt: longAgo } });
    controls().setStatus(paid.paymentId, "approved", "accredited");

    const applied: string[] = [];
    const result = await expireStaleOrders(testDb, { stripe: null, mercadopago: mp }, { onApplied: async (outcome) => void applied.push(outcome.result) });
    expect(result.expired).toBe(1);
    expect(await orderRow(lapsed.id)).toMatchObject({ status: "CANCELLED", cancelReason: "expired" });
    expect(controls().get(lapsed.paymentId)?.status).toBe("cancelled");
    expect((await orderRow(paid.id)).status).toBe("PAID");
    expect((await orderRow(fresh.id)).status).toBe("PAYMENT_PENDING");
    expect(applied.sort()).toEqual(["cancelled", "paid"]);
  });
});
