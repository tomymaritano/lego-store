import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getCheckoutOrder } from "@/lib/orders/checkout";
import { CHECKOUT_MESSAGES, NO_STORE, checkoutError, crossSite, jsonBody, mercadoPagoOr503, rateLimited, requesterOf } from "@/lib/orders/http";
import { syncMercadoPagoOrder } from "@/lib/orders/mercadopago";
import { afterMercadoPagoPayment } from "@/lib/orders/payment-effects";
import type { CheckoutOrderResponse } from "@/lib/orders/types";
import { rateLimits } from "@/lib/rate-limit";
import { orderIdSchema, syncOrderSchema } from "@/lib/validations/orders";

/**
 * POST /api/checkout/orders/<id>/sync: back from Mercado Pago (Checkout Pro
 * returns to /checkout/pedido/<id>?payment_id=…), the order asks Mercado Pago
 * how its payment stands instead of waiting for the webhook (which cannot
 * reach a local server). Body: { paymentId? }, what the return URL said: it
 * is only used when Mercado Pago confirms that payment is this order's.
 * Only for the order's owner or the browser holding its checkout cookie.
 *
 * 200 { order } · 400 · 413 · 404 · 429 · 502 Mercado Pago did not answer · 503.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const refused = crossSite(request);
  if (refused) return refused;
  const payments = mercadoPagoOr503();
  if ("response" in payments) return payments.response;

  const id = orderIdSchema.safeParse((await params).orderId);
  const read = await jsonBody(request);
  if (!read.ok) return read.response;
  const body = syncOrderSchema.safeParse(read.body ?? {});
  if (!id.success || !body.success) return checkoutError("invalid", CHECKOUT_MESSAGES.invalid, 400);

  const requester = await requesterOf(request);
  const db = getDb();
  if (!(await getCheckoutOrder(db, id.data, requester))) return checkoutError("not_found", CHECKOUT_MESSAGES.not_found, 404);
  const limited = await rateLimited(rateLimits.checkoutPay, request, requester);
  if (limited) return limited;

  try {
    const outcome = await syncMercadoPagoOrder(db, payments.mp, id.data, body.data.paymentId ?? null);
    await afterMercadoPagoPayment(db, outcome);
  } catch (error) {
    console.error(`[checkout] No se pudo consultar el pago del pedido ${id.data}:`, error);
    return checkoutError("server", CHECKOUT_MESSAGES.server, 502);
  }
  const order = await getCheckoutOrder(db, id.data, requester);
  if (!order) return checkoutError("not_found", CHECKOUT_MESSAGES.not_found, 404);
  return NextResponse.json({ order } satisfies CheckoutOrderResponse, { headers: NO_STORE });
}
