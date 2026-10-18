import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { expireStaleOrders } from "@/lib/orders/expire";
import { getPaymentGateway } from "@/lib/payments/config";

/**
 * GET /api/cron/expire-orders: cancels checkouts left PENDING for a day,
 * and their PaymentIntents (lib/orders/expire.ts). For a scheduler: Vercel
 * Cron sends `Authorization: Bearer $CRON_SECRET` by itself; elsewhere, any
 * job that does the same (README, "Pedidos pendientes"). Without CRON_SECRET
 * the route is off (503).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return Response.json({ error: "CRON_SECRET no está configurado." }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const gateway = getPaymentGateway();
  if (!gateway) return Response.json({ error: "Pagos no configurados." }, { status: 503 });
  const result = await expireStaleOrders(getDb(), gateway);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
