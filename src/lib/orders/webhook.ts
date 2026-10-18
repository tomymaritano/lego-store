import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { toCentavos, type PaymentGateway } from "@/lib/payments/gateway";

/*
 * What Stripe's webhook does to orders (the route verifies the signature
 * first: src/app/api/stripe/webhook/route.ts).
 *
 *   payment_intent.succeeded       PENDING -> PAID, taking the stock; or, when
 *                                  any line is short, or Stripe charged anything
 *                                  but the order's total, refund -> CANCELLED
 *   payment_intent.payment_failed  stays PENDING (the customer can try another
 *                                  card), out of "Mis pedidos" again
 *   payment_intent.canceled        PENDING -> CANCELLED
 *
 * Each event is handled at most once: its id goes into ProcessedStripeEvent
 * in the same transaction as its changes, so a replay (Stripe retries, or
 * resends) finds it and does nothing, and a failure rolls both back so
 * Stripe's retry does the work. Concurrent deliveries of the same event wait
 * on that row's unique key.
 *
 * Stock is taken with the product rows locked (in id order, so two orders
 * never deadlock) and a conditional decrement: two payments racing for the
 * last unit serialise there, and the second finds it gone and is refunded.
 *
 * The charge is checked before anything else: the event's amount_received
 * and currency must be the order's total (in centavos) and currency, read
 * under the order's lock. The checkout never lets them drift apart
 * (./checkout.ts locks the order while it pays or re-prices it), and this is
 * what keeps a drift, from any cause, from selling lines that were not paid.
 */

export interface WebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

export type WebhookOutcome =
  | { result: "ignored" }
  | { result: "duplicate" }
  | { result: "unchanged"; orderId: string }
  | { result: "paid"; orderId: string; productIds: string[] }
  | { result: "out_of_stock"; orderId: string }
  | { result: "amount_mismatch"; orderId: string }
  | { result: "refunded"; orderId: string }
  | { result: "cancelled"; orderId: string };

const HANDLED = new Set(["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"]);

interface IntentObject {
  id: string;
  /** Centavos actually charged (Stripe's PaymentIntent.amount_received). */
  amount_received?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}

function intentOf(event: WebhookEvent): IntentObject | null {
  const object = event.data.object as Partial<IntentObject> | null;
  return object && typeof object.id === "string" ? (object as IntentObject) : null;
}

type Tx = Prisma.TransactionClient;

/** Records the event; false when it was already processed. */
async function claimEvent(tx: Tx, event: WebhookEvent): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "ProcessedStripeEvent" ("id", "type") VALUES (${event.id}, ${event.type})
    ON CONFLICT ("id") DO NOTHING
    RETURNING "id"
  `;
  return rows.length > 0;
}

/** The order of a PaymentIntent, locked for this transaction. */
async function lockOrder(tx: Tx, intent: IntentObject) {
  const ids = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order" WHERE "stripePaymentIntentId" = ${intent.id} FOR UPDATE
  `;
  const id = ids[0]?.id;
  if (!id) return null;
  return tx.order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      total: true,
      currency: true,
      stripeRefundId: true,
      items: { select: { productId: true, quantity: true } },
    },
  });
}

type LockedOrder = NonNullable<Awaited<ReturnType<typeof lockOrder>>>;

/** Takes the stock of every line, or none of it. False when any line is short (or its product is gone). */
async function takeStock(tx: Tx, order: LockedOrder): Promise<boolean> {
  if (order.items.some((item) => item.productId === null)) return false;
  const wanted = new Map(order.items.map((item) => [item.productId!, item.quantity]));
  const ids = [...wanted.keys()].sort();
  const products = await tx.$queryRaw<{ id: string; stock: number }[]>`
    SELECT "id", "stock" FROM "Product" WHERE "id" = ANY(${ids}::text[]) ORDER BY "id" FOR UPDATE
  `;
  if (products.length !== ids.length) return false;
  if (products.some((product) => product.stock < wanted.get(product.id)!)) return false;
  for (const id of ids) {
    const updated = await tx.$executeRaw`
      UPDATE "Product" SET "stock" = "stock" - ${wanted.get(id)!}, "updatedAt" = now()
      WHERE "id" = ${id} AND "stock" >= ${wanted.get(id)!}
    `;
    // Cannot happen with the rows locked; if it ever does, roll the whole order back.
    if (updated !== 1) throw new Error(`Stock of ${id} changed under a lock`);
  }
  return true;
}

async function refundInto(tx: Tx, gateway: PaymentGateway, orderId: string, intentId: string) {
  const refund = await gateway.refund(intentId, `order/${orderId}/refund`);
  await tx.order.update({ where: { id: orderId }, data: { stripeRefundId: refund.id } });
}

/** Whether Stripe charged exactly the order's total, in its currency. */
export function chargedInFull(intent: IntentObject, order: { total: number; currency: string }): boolean {
  return intent.amount_received === toCentavos(order.total) && intent.currency?.toLowerCase() === order.currency.toLowerCase();
}

async function onSucceeded(tx: Tx, gateway: PaymentGateway, intent: IntentObject): Promise<WebhookOutcome> {
  const order = await lockOrder(tx, intent);
  if (!order) return { result: "ignored" };

  if (order.status === "PENDING" && !chargedInFull(intent, order)) {
    // Never sell lines for a different amount than their total: the money goes back.
    console.error(
      `[stripe] ${intent.id} cobró ${intent.amount_received ?? "?"} ${intent.currency ?? "?"}; el pedido ${order.id} es de ${toCentavos(order.total)} ${order.currency}. Se reembolsa y se cancela.`
    );
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "amount_mismatch" },
    });
    await refundInto(tx, gateway, order.id, intent.id);
    return { result: "amount_mismatch", orderId: order.id };
  }

  if (order.status === "PENDING") {
    if (await takeStock(tx, order)) {
      const now = new Date();
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: now } });
      await tx.order.updateMany({ where: { id: order.id, submittedAt: null }, data: { submittedAt: now } });
      const productIds = order.items.map((item) => item.productId!);
      // The purchased lines leave the account's cart (anything added meanwhile stays).
      if (order.userId) await tx.cartItem.deleteMany({ where: { userId: order.userId, productId: { in: productIds } } });
      return { result: "paid", orderId: order.id, productIds };
    }
    // Someone else got the last units first: give the money back.
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "out_of_stock" },
    });
    await refundInto(tx, gateway, order.id, intent.id);
    return { result: "out_of_stock", orderId: order.id };
  }

  // Cancelled while its payment went through (expired, replaced): the money goes back.
  if (order.status === "CANCELLED" && !order.stripeRefundId) {
    await refundInto(tx, gateway, order.id, intent.id);
    return { result: "refunded", orderId: order.id };
  }
  return { result: "unchanged", orderId: order.id };
}

async function onCanceled(tx: Tx, intent: IntentObject): Promise<WebhookOutcome> {
  const order = await lockOrder(tx, intent);
  if (!order) return { result: "ignored" };
  if (order.status !== "PENDING") return { result: "unchanged", orderId: order.id };
  await tx.order.update({
    where: { id: order.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "payment_canceled" },
  });
  return { result: "cancelled", orderId: order.id };
}

/**
 * Applies one verified event. Throws (and changes nothing) when the work
 * could not be done, e.g. a refund request failed: the route answers 500 and
 * Stripe retries.
 */
export async function handleStripeEvent(db: PrismaClient, gateway: PaymentGateway, event: WebhookEvent): Promise<WebhookOutcome> {
  const intent = intentOf(event);
  if (!HANDLED.has(event.type) || !intent) return { result: "ignored" };

  return db.$transaction(
    async (tx) => {
      if (!(await claimEvent(tx, event))) return { result: "duplicate" } as const;
      switch (event.type) {
        case "payment_intent.succeeded":
          return onSucceeded(tx, gateway, intent);
        case "payment_intent.canceled":
          return onCanceled(tx, intent);
        default: {
          // payment_failed (e.g. 3D Secure refused): the order waits for another card (or the cleanup),
          // and is not a purchase until one goes through.
          const order = await lockOrder(tx, intent);
          if (!order) return { result: "ignored" } as const;
          if (order.status === "PENDING") await tx.order.update({ where: { id: order.id }, data: { submittedAt: null } });
          return { result: "unchanged", orderId: order.id } as const;
        }
      }
    },
    // A refund is a network call inside the transaction: give it room.
    { timeout: 30_000, maxWait: 10_000 }
  );
}
