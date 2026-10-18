import type { PrismaClient } from "@/generated/prisma/client";
import { orderTotals } from "@/lib/pricing";
import { PaymentDeclinedError, REUSABLE_INTENT_STATUSES, toCentavos, type IntentStatus, type PaymentGateway } from "@/lib/payments/gateway";
import type { PrepareOrderInput } from "@/lib/validations/orders";
import { canAccessOrder, hashAccessToken, newAccessToken, type CheckoutAccess, type Requester } from "./access";
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
 */

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
async function priceLines(db: PrismaClient, wanted: { productId: string; quantity: number }[]): Promise<Priced> {
  const products = await db.product.findMany({
    where: { id: { in: wanted.map((line) => line.productId) } },
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
  const { count } = await db.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });
  return count > 0;
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
    ? await db.order.findUnique({
        where: { id: requester.access.orderId },
        select: { id: true, userId: true, status: true, checkoutTokenHash: true, stripePaymentIntentId: true },
      })
    : null;
  if (current && current.status === "PENDING" && canAccessOrder(current, requester)) {
    const intent = current.stripePaymentIntentId ? await gateway.retrieveIntent(current.stripePaymentIntentId) : null;
    if (intent && current.userId === requester.userId && REUSABLE_INTENT_STATUSES.includes(intent.status)) {
      const updated = await db.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({ where: { id: current.id, status: "PENDING" }, data });
        if (count === 0) return false;
        await tx.orderItem.deleteMany({ where: { orderId: current.id } });
        await tx.orderItem.createMany({ data: lines.map((line) => ({ ...line, orderId: current.id })) });
        return true;
      });
      if (updated) {
        if (intent.amount !== amount) await gateway.updateIntentAmount(intent.id, amount);
        return { ok: true, order: (await getOrderView(db, current.id))!, access: null };
      }
    } else if (!intent || !PAYMENT_IN_FLIGHT.includes(intent.status)) {
      await retireOrder(db, gateway, current, "superseded");
    }
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
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      total: true,
      checkoutTokenHash: true,
      stripePaymentIntentId: true,
      items: { select: { productId: true, quantity: true } },
    },
  });
  if (!order || !canAccessOrder(order, requester)) return { ok: false, code: "not_found" };
  const view = async () => (await getOrderView(db, order.id))!;
  if (order.status !== "PENDING" || !order.stripePaymentIntentId) return { ok: false, code: "not_pending", order: await view() };

  let intent = await gateway.retrieveIntent(order.stripePaymentIntentId);
  // Paid already (a double click, a retried request): nothing to do but wait for the webhook.
  if (PAYMENT_IN_FLIGHT.includes(intent.status)) return { ok: true, next: "done", order: await view() };
  if (intent.status === "canceled") {
    await db.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "payment_canceled" },
    });
    return { ok: false, code: "not_pending", order: await view() };
  }

  // Fail before charging when the stock is already gone (the webhook re-checks atomically).
  const wanted = order.items.flatMap((item) => (item.productId ? [{ productId: item.productId, quantity: item.quantity }] : []));
  const priced = wanted.length === order.items.length ? await priceLines(db, wanted) : null;
  if (!priced || !priced.ok) {
    return { ok: false, code: "unavailable", unavailable: priced && !priced.ok ? priced.unavailable : [] };
  }

  const amount = toCentavos(order.total);
  if (intent.amount !== amount) intent = await gateway.updateIntentAmount(intent.id, amount);

  await db.order.updateMany({ where: { id: order.id, submittedAt: null }, data: { submittedAt: new Date() } });
  try {
    intent = await gateway.confirmIntent(intent.id, confirmationTokenId, `order/${order.id}/confirm/${confirmationTokenId}`);
  } catch (error) {
    if (error instanceof PaymentDeclinedError) {
      return { ok: false, code: error.code === "declined" ? "declined" : "payment_method", message: error.message };
    }
    throw error;
  }

  switch (intent.status) {
    case "requires_action":
      if (!intent.clientSecret) throw new Error(`PaymentIntent ${intent.id} needs an action but has no client secret`);
      return { ok: true, next: "action", clientSecret: intent.clientSecret, order: await view() };
    case "requires_payment_method":
      return { ok: false, code: "declined", message: "Tu banco rechazó el pago. Prueba con otra tarjeta." };
    default:
      return { ok: true, next: "done", order: await view() };
  }
}

/** The order the checkout shows (its confirmation polls this), when the requester may see it. */
export async function getCheckoutOrder(db: PrismaClient, orderId: string, requester: Requester): Promise<OrderView | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true, checkoutTokenHash: true } });
  if (!order || !canAccessOrder(order, requester)) return null;
  return getOrderView(db, order.id);
}
