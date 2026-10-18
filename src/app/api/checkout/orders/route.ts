import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { prepareOrder } from "@/lib/orders/checkout";
import {
  CHECKOUT_MESSAGES,
  NO_STORE,
  checkoutError,
  crossSite,
  gatewayOr503,
  jsonBody,
  rateLimited,
  requesterOf,
  setCheckoutCookie,
} from "@/lib/orders/http";
import type { CheckoutOrderResponse } from "@/lib/orders/types";
import { rateLimits } from "@/lib/rate-limit";
import { prepareOrderSchema } from "@/lib/validations/orders";

/**
 * POST /api/checkout/orders: the checkout reached "Revisar".
 * Body: { shipping, lines: [{ productId, quantity }], confirmationTokenId }.
 * Creates this browser's PENDING order and its PaymentIntent (or updates the
 * pending one), with prices, stock and totals from the database. A new order
 * comes with the checkout cookie that lets this browser pay and follow it.
 *
 * 200 { order } · 400 invalid · 409 unavailable (with the lines) · 422 the
 * card token cannot be used · 429 · 503 payments not configured.
 */
export async function POST(request: NextRequest) {
  const refused = crossSite(request);
  if (refused) return refused;
  const payments = gatewayOr503();
  if ("response" in payments) return payments.response;

  const parsed = prepareOrderSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return checkoutError("invalid", CHECKOUT_MESSAGES.invalid, 400);

  const requester = await requesterOf(request);
  const limited = await rateLimited(rateLimits.checkoutPrepare, request, requester);
  if (limited) return limited;

  try {
    const outcome = await prepareOrder(getDb(), payments.gateway, parsed.data, requester);
    if (!outcome.ok) {
      return outcome.code === "unavailable"
        ? checkoutError("unavailable", CHECKOUT_MESSAGES.unavailable, 409, { unavailable: outcome.unavailable })
        : checkoutError("payment_method", CHECKOUT_MESSAGES.payment_method, 422);
    }
    const response = NextResponse.json({ order: outcome.order } satisfies CheckoutOrderResponse, { headers: NO_STORE });
    if (outcome.access) setCheckoutCookie(response, outcome.access);
    return response;
  } catch (error) {
    console.error("[checkout] No se pudo preparar el pedido:", error);
    return checkoutError("server", CHECKOUT_MESSAGES.server, 502);
  }
}
