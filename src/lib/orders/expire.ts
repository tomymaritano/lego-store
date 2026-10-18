import type { PrismaClient } from "@/generated/prisma/client";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { retireAnyOrder, type OnApplied } from "./mercadopago";
import { asOrderPayments, type OrderPayments } from "./payments";

/*
 * Stale orders: checkouts that reached "Revisar" and were never paid, and
 * Mercado Pago payments that never settled. Two things retire them:
 * - a new attempt from the same browser updates its pending order or, when
 *   that one cannot be paid any more, cancels it (prepareOrder,
 *   prepareMercadoPagoOrder);
 * - this sweep, run by GET /api/cron/expire-orders (Vercel Cron, or any
 *   scheduler that sends the CRON_SECRET):
 *   · PENDING orders untouched for a day are cancelled, with their Stripe
 *     PaymentIntent;
 *   · PAYMENT_PENDING (Mercado Pago) orders whose cash ticket expired a while
 *     ago, or whose payment has been pending for a week, are looked up in
 *     Mercado Pago: a payment that went through is applied (the webhook was
 *     lost), one still pending is cancelled there and the order with it.
 *   Orders whose payment is under way are left for the webhook.
 */

/** Pending orders untouched for this long are cancelled. */
export const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;
/** Mercado Pago marks an unpaid ticket cancelled when it expires; after this much more, the sweep asks itself. */
export const TICKET_GRACE_MS = 24 * 60 * 60 * 1000;
/** A payment pending this long (a card under review, a ticket without expiry) is given up. */
export const PAYMENT_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function expireStaleOrders(
  db: PrismaClient,
  payments: PaymentGateway | OrderPayments,
  {
    now = new Date(),
    ttlMs = PENDING_ORDER_TTL_MS,
    limit = 100,
    onApplied,
  }: { now?: Date; ttlMs?: number; limit?: number; /** Mercado Pago changes the sweep applied (for their emails). */ onApplied?: OnApplied } = {}
): Promise<{ expired: number; skipped: number }> {
  const clients = asOrderPayments(payments);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const stale = await db.order.findMany({
    where: {
      OR: [
        { status: "PENDING", updatedAt: { lt: ago(ttlMs) } },
        {
          status: "PAYMENT_PENDING",
          OR: [{ ticketExpiresAt: { lt: ago(TICKET_GRACE_MS) } }, { updatedAt: { lt: ago(PAYMENT_PENDING_TTL_MS) } }],
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true, paymentProvider: true, stripePaymentIntentId: true, providerPaymentId: true },
  });
  let expired = 0;
  for (const order of stale) {
    try {
      if (await retireAnyOrder(db, clients, order, "expired", onApplied)) expired += 1;
    } catch (error) {
      console.error(`[orders] No se pudo expirar el pedido ${order.id}:`, error);
    }
  }
  return { expired, skipped: stale.length - expired };
}
