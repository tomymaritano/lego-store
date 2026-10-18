import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { orderTotals } from "@/lib/pricing";
import { PaymentDeclinedError, REUSABLE_INTENT_STATUSES, toCentavos, type IntentStatus, type PaymentGateway } from "@/lib/payments/gateway";
import type { PrepareOrderInput } from "@/lib/validations/orders";
import { accessSelect, canAccessOrder, hashAccessToken, newAccessToken, type CheckoutAccess, type Requester } from "./access";
import { getOrderView } from "./queries";
import type { CancelReason, OrderView, UnavailableLine } from "./types";

/*
 * The checkout on the server, in two calls (see the design doc, "Qué paso cobra"):
 *
 * 1. prepareOrder, when the customer reaches "Revisar": prices the lines
 *    from the database (never from the client), checks the stock, computes
 *    shipping and totals with lib/pricing, reads the card's brand and last 4
 *    digits from the ConfirmationToken, and creates the PENDING order with
 *    a PaymentIntent for its total (or updates this browser's pending order
 *    and its intent, when there is one that can still be paid).
 * 2. payOrder, on "Realizar pedido": confirms the PaymentIntent with the
 *    ConfirmationToken. The money moves here, but the order only becomes
 *    PAID when Stripe's webhook says so (./webhook.ts), which is also where
 *    the stock is taken atomically.
 *
 * Both take the database and the payment gateway first, so the Route
 * Handlers pass the app's and the integration tests their own.
 *
 * One writer per order at a time: whatever changes an order's amount or
 * pays it (re-preparing, paying, retiring) runs in a transaction that first
 * locks the order's row, and talks to Stripe while holding it. So "Realizar
 * pedido" and a new "Revisar" from the same browser cannot interleave: the
 * intent is confirmed for the total of the lines the order holds, and a
 * re-prepare changes Stripe's amount before it commits new lines (and not
 * at all once the intent cannot take it). The webhook still compares what
 * was charged with the order's total before it takes any stock (./webhook.ts).
 */

type Tx = Prisma.TransactionClient;

/** Room for Stripe's round trips inside a transaction that holds an order's lock. */
const LOCKED_TX = { timeout: 30_000, maxWait: 10_000 } as const;

/** Locks the order's row until the transaction ends; false when there is no such order. */
async function lockOrderRow(tx: Tx, orderId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  return rows.length > 0;
}

const PAYMENT_IN_FLIGHT: readonly IntentStatus[] = ["processing", "succeeded", "requires_capture"];

interface PricedLine {
  productId: string;
  name: string;
  unitPrice: number;
  image: string;
  quantity: number;
}

type Priced = { ok: true; lines: PricedLine[] } | { ok: false; unavailable: UnavailableLine[] };

/** The lines at today's prices, or what cannot be sold as asked. */
async function priceLines(db: Db, wanted: { productId: string; quantity: number }[]): Promise<Priced> {
  const products = await db.product.findMany({
    // Archived products are off the store: they read as gone (available 0).
    where: { id: { in: wanted.map((line) => line.productId) }, archivedAt: null },
    select: { id: true, name: true, price: true, img: true, stock: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const unavailable: UnavailableLine[] = [];
  const lines: PricedLine[] = [];
  for (const { productId, quantity } of wanted) {
    const product = byId.get(productId);
    if (!product) unavailable.push({ productId, name: null, available: 0 });
    else if (product.stock < quantity) unavailable.push({ productId, name: product.name, available: product.stock });
    else lines.push({ productId, name: product.name, unitPrice: product.price, image: product.img, quantity });
  }
  return unavailable.length > 0 ? { ok: false, unavailable } : { ok: true, lines };
}

/**
 * Cancels a pending order that will not be paid (replaced by a newer one,
 * expired) and its PaymentIntent. An order whose payment is already under
 * way is left for the webhook to settle.
 */
export async function retireOrder(
  db: PrismaClient,
  gateway: PaymentGateway,
  order: { id: string; stripePaymentIntentId: string | null },
  reason: CancelReason
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    if (!(await lockOrderRow(tx, order.id))) return false;
    if (order.stripePaymentIntentId) {
      const intent = await gateway.retrieveIntent(order.stripePaymentIntentId);
      if (PAYMENT_IN_FLIGHT.includes(intent.status)) return false;
      if (intent.status !== "canceled") {
        try {
          await gateway.cancelIntent(intent.id);
        } catch (error) {
          // It moved on meanwhile (a payment went through): the webhook settles the order.
          console.warn(`[orders] No se pudo cancelar el pago de ${order.id}:`, error);
          return false;
        }
      }
    }
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    return count > 0;
  }, LOCKED_TX);
}

export type PrepareOutcome =
  | { ok: true; order: OrderView; /** Set when a new order was created: the browser's new cookie. */ access: CheckoutAccess | null }
  | { ok: false; code: "unavailable"; unavailable: UnavailableLine[] }
  | { ok: false; code: "payment_method" };

export async function prepareOrder(
  db: PrismaClient,
  gateway: PaymentGateway,
  input: PrepareOrderInput,
  requester: Requester
): Promise<PrepareOutcome> {
  const priced = await priceLines(db, input.lines);
  if (!priced.ok) return { ok: false, code: "unavailable", unavailable: priced.unavailable };
  const { lines } = priced;
  const totals = orderTotals(lines.map((line) => ({ price: line.unitPrice, quantity: line.quantity })));

  const card = await gateway.readConfirmationToken(input.confirmationTokenId);
  if (!card) return { ok: false, code: "payment_method" };

  const { shipping } = input;
  const email = shipping.email.trim().toLowerCase();
  const data = {
    email,
    firstName: shipping.firstName,
    lastName: shipping.lastName,
    phone: shipping.phone,
    address: shipping.address,
    city: shipping.city,
    state: shipping.state,
    zipCode: shipping.zipCode.toUpperCase(),
    country: shipping.country,
    subtotal: totals.subtotal,
    shipping: totals.shipping.cost,
    total: totals.total,
    paymentBrand: card.brand,
    paymentLast4: card.last4,
  };
  const amount = toCentavos(totals.total);

  // This browser's pending order: update it when it can still be paid, retire it otherwise.
  const current = requester.access
    ? await db.order.findUnique({ where: { id: requester.access.orderId }, select: { ...accessSelect, stripePaymentIntentId: true } })
    : null;
  if (current && current.status === "PENDING" && canAccessOrder(current, requester)) {
    const intentId = current.stripePaymentIntentId;
    const reused =
      intentId !== null &&
      current.userId === requester.userId &&
      (await db.$transaction(async (tx) => {
        // Locked: a payment of this order already finished, or waits until this one does.
        if (!(await lockOrderRow(tx, current.id))) return false;
        const locked = await tx.order.findUnique({ where: { id: current.id }, select: { status: true } });
        if (locked?.status !== "PENDING") return false;
        const intent = await gateway.retrieveIntent(intentId);
        if (!REUSABLE_INTENT_STATUSES.includes(intent.status)) return false;
        // Stripe first: when it refuses the new amount this throws, and the order keeps its lines and total.
        if (intent.amount !== amount) await gateway.updateIntentAmount(intent.id, amount);
        await tx.order.update({ where: { id: current.id }, data });
        await tx.orderItem.deleteMany({ where: { orderId: current.id } });
        await tx.orderItem.createMany({ data: lines.map((line) => ({ ...line, orderId: current.id })) });
        return true;
      }, LOCKED_TX));
    if (reused) return { ok: true, order: (await getOrderView(db, current.id))!, access: null };
    // A new order replaces it (another account, or its intent moved on); retireOrder
    // leaves an order whose payment is under way to the webhook.
    await retireOrder(db, gateway, current, "superseded");
  }

  const token = newAccessToken();
  const order = await db.order.create({
    data: { ...data, userId: requester.userId, checkoutTokenHash: hashAccessToken(token), items: { create: lines } },
    select: { id: true, number: true },
  });
  try {
    const intent = await gateway.createIntent({
      orderId: order.id,
      orderNumber: order.number,
      amount,
      email,
      idempotencyKey: `order/${order.id}/intent`,
    });
    await db.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: intent.id } });
  } catch (error) {
    await db.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "payment_setup_failed" },
    });
    throw error;
  }
  return { ok: true, order: (await getOrderView(db, order.id))!, access: { orderId: order.id, token } };
}

/** Paying with a card other than the one reviewed. */
export const CARD_CHANGED_MESSAGE = "La tarjeta no coincide con la que revisaste. Vuelve a ingresarla y revisa tu pedido.";

export type PayOutcome =
  | { ok: true; next: "done"; order: OrderView }
  | { ok: true; next: "action"; clientSecret: string; order: OrderView }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "not_pending"; order: OrderView }
  | { ok: false; code: "unavailable"; unavailable: UnavailableLine[] }
  | { ok: false; code: "declined" | "payment_method"; message: string };

export async function payOrder(
  db: PrismaClient,
  gateway: PaymentGateway,
  orderId: string,
  confirmationTokenId: string,
  requester: Requester
): Promise<PayOutcome> {
  // The order stays locked for the whole payment: the amount confirmed is the total of the lines it holds.
  return db.$transaction(async (tx): Promise<PayOutcome> => {
    if (!(await lockOrderRow(tx, orderId))) return { ok: false, code: "not_found" };
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        ...accessSelect,
        total: true,
        stripePaymentIntentId: true,
        paymentBrand: true,
        paymentLast4: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order || !canAccessOrder(order, requester)) return { ok: false, code: "not_found" };
    const view = async () => (await getOrderView(tx, order.id))!;
    if (order.status !== "PENDING" || !order.stripePaymentIntentId) return { ok: false, code: "not_pending", order: await view() };

    let intent = await gateway.retrieveIntent(order.stripePaymentIntentId);
    // Paid already (a double click, a retried request): nothing to do but wait for the webhook.
    if (PAYMENT_IN_FLIGHT.includes(intent.status)) return { ok: true, next: "done", order: await view() };
    if (intent.status === "canceled") {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "payment_canceled" },
      });
      return { ok: false, code: "not_pending", order: await view() };
    }

    // Fail before charging when the stock is already gone (the webhook re-checks atomically).
    const wanted = order.items.flatMap((item) => (item.productId ? [{ productId: item.productId, quantity: item.quantity }] : []));
    const priced = wanted.length === order.items.length ? await priceLines(tx, wanted) : null;
    if (!priced || !priced.ok) {
      return { ok: false, code: "unavailable", unavailable: priced && !priced.ok ? priced.unavailable : [] };
    }

    // The card charged is the one "Revisar" showed (and the order, its emails and the admin record):
    // another token sends the customer back to the payment step to review the order again.
    const card = await gateway.readConfirmationToken(confirmationTokenId);
    if (!card || card.brand !== order.paymentBrand || card.last4 !== order.paymentLast4) {
      return { ok: false, code: "payment_method", message: CARD_CHANGED_MESSAGE };
    }

    const amount = toCentavos(order.total);
    if (intent.amount !== amount) intent = await gateway.updateIntentAmount(intent.id, amount);

    // A refused card is not a purchase: the order leaves "Mis pedidos" (an earlier 3D Secure attempt may have listed it).
    const declined = async (code: "declined" | "payment_method", message: string): Promise<PayOutcome> => {
      await tx.order.update({ where: { id: order.id }, data: { submittedAt: null } });
      return { ok: false, code, message };
    };
    try {
      intent = await gateway.confirmIntent(intent.id, confirmationTokenId, `order/${order.id}/confirm/${confirmationTokenId}`);
    } catch (error) {
      if (error instanceof PaymentDeclinedError) return declined(error.code === "declined" ? "declined" : "payment_method", error.message);
      throw error;
    }
    if (intent.status === "requires_payment_method") return declined("declined", "Tu banco rechazó el pago. Prueba con otra tarjeta.");

    // Paid, processing or waiting on the bank (3D Secure): the order is placed.
    await tx.order.updateMany({ where: { id: order.id, submittedAt: null }, data: { submittedAt: new Date() } });
    if (intent.status === "requires_action") {
      if (!intent.clientSecret) throw new Error(`PaymentIntent ${intent.id} needs an action but has no client secret`);
      return { ok: true, next: "action", clientSecret: intent.clientSecret, order: await view() };
    }
    return { ok: true, next: "done", order: await view() };
  }, LOCKED_TX);
}

/** The order the checkout shows (its confirmation polls this), when the requester may see it. */
export async function getCheckoutOrder(db: PrismaClient, orderId: string, requester: Requester): Promise<OrderView | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: accessSelect });
  if (!order || !canAccessOrder(order, requester)) return null;
  return getOrderView(db, order.id);
}
