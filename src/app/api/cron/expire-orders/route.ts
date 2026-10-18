import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { expireStaleOrders } from "@/lib/orders/expire";
import { appPayments } from "@/lib/orders/http";
import { afterMercadoPagoPayment } from "@/lib/orders/payment-effects";

/**
 * GET /api/cron/expire-orders: cancels checkouts left PENDING for a day
 * (and their Stripe PaymentIntents), and settles Mercado Pago payments that
 * stayed pending past their ticket's expiry (lib/orders/expire.ts). For a scheduler: Vercel
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

  const payments = appPayments();
  if (!payments.stripe && !payments.mercadopago) return Response.json({ error: "Pagos no configurados." }, { status: 503 });
  const db = getDb();
  const result = await expireStaleOrders(db, payments, { onApplied: (outcome) => afterMercadoPagoPayment(db, outcome) });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
