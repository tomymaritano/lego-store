import type { PrismaClient } from "@/generated/prisma/client";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { retireOrder } from "./checkout";

/*
 * Stale PENDING orders: checkouts that reached "Revisar" and were never paid.
 * Two things retire them:
 * - a new attempt from the same browser updates its pending order or, when
 *   that one cannot be paid any more, cancels it (prepareOrder);
 * - this sweep, run by GET /api/cron/expire-orders (Vercel Cron, or any
 *   scheduler that sends the CRON_SECRET), cancels the rest after a while,
 *   along with their PaymentIntents. Orders whose payment is under way are
 *   left for the webhook.
 */

/** Pending orders untouched for this long are cancelled. */
export const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

export async function expireStaleOrders(
  db: PrismaClient,
  gateway: PaymentGateway,
  { now = new Date(), ttlMs = PENDING_ORDER_TTL_MS, limit = 100 }: { now?: Date; ttlMs?: number; limit?: number } = {}
): Promise<{ expired: number; skipped: number }> {
  const stale = await db.order.findMany({
    where: { status: "PENDING", updatedAt: { lt: new Date(now.getTime() - ttlMs) } },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true, stripePaymentIntentId: true },
  });
  let expired = 0;
  for (const order of stale) {
    try {
      if (await retireOrder(db, gateway, order, "expired")) expired += 1;
    } catch (error) {
      console.error(`[orders] No se pudo expirar el pedido ${order.id}:`, error);
    }
  }
  return { expired, skipped: stale.length - expired };
}
