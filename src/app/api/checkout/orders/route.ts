import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { prepareOrder, type PrepareOutcome } from "@/lib/orders/checkout";
import {
  CHECKOUT_MESSAGES,
  NO_STORE,
  appPayments,
  checkoutError,
  crossSite,
  gatewayOr503,
  jsonBody,
  mercadoPagoOr503,
  providerFor,
  rateLimited,
  requesterOf,
  setCheckoutCookie,
} from "@/lib/orders/http";
import { prepareMercadoPagoOrder } from "@/lib/orders/mercadopago";
import type { CheckoutOrderResponse } from "@/lib/orders/types";
import { rateLimits } from "@/lib/rate-limit";
import { prepareMercadoPagoOrderSchema, prepareOrderSchema } from "@/lib/validations/orders";

/**
 * POST /api/checkout/orders: the checkout reached "Revisar".
 * Body: { shipping, lines: [{ productId, quantity }], couponCode? } plus, for Stripe,
 * { confirmationTokenId } or, for Mercado Pago, { provider: "MERCADOPAGO" }
 * (the provider is the store's: PAYMENT_PROVIDER). Creates this browser's
 * PENDING order (with a PaymentIntent, for Stripe) or updates the pending one,
 * with prices, stock, the coupon's discount and totals from the database (the
 * coupon's use is reserved for the order). A new order comes with the
 * checkout cookie that lets this browser pay and follow it.
 *
 * 200 { order } · 400 invalid · 409 unavailable (with the lines) · 422 the
 * payment step has to be done again (a spent card token, or it was for the
 * other provider), or code "coupon": the coupon cannot be used (with why) ·
 * 429 · 503 payments not configured.
 */
export async function POST(request: NextRequest) {
  const refused = crossSite(request);
  if (refused) return refused;
  const provider = providerFor(request);
  const payments = provider === "STRIPE" ? gatewayOr503() : mercadoPagoOr503();
  if ("response" in payments) return payments.response;

  const body = await jsonBody(request);
  const stripe = provider === "STRIPE" ? prepareOrderSchema.safeParse(body) : null;
  const mercadopago = provider === "MERCADOPAGO" ? prepareMercadoPagoOrderSchema.safeParse(body) : null;
  if (!stripe?.success && !mercadopago?.success) {
    // A well-formed request for the other provider: the payment step is stale (the store switched providers).
    const other = provider === "STRIPE" ? prepareMercadoPagoOrderSchema.safeParse(body) : prepareOrderSchema.safeParse(body);
    return other.success
      ? checkoutError("payment_method", CHECKOUT_MESSAGES.provider_changed, 422)
      : checkoutError("invalid", CHECKOUT_MESSAGES.invalid, 400);
  }

  const requester = await requesterOf(request);
  const limited = await rateLimited(rateLimits.checkoutPrepare, request, requester);
  if (limited) return limited;

  try {
    let outcome: PrepareOutcome;
    if (stripe?.success && "gateway" in payments) outcome = await prepareOrder(getDb(), payments.gateway, stripe.data, requester);
    else outcome = await prepareMercadoPagoOrder(getDb(), appPayments(), mercadopago!.data!, requester);
    if (!outcome.ok) {
      switch (outcome.code) {
        case "unavailable":
          return checkoutError("unavailable", CHECKOUT_MESSAGES.unavailable, 409, { unavailable: outcome.unavailable });
        case "coupon":
          return checkoutError("coupon", outcome.message, 422, { rejection: outcome.rejection });
        default:
          return checkoutError("payment_method", CHECKOUT_MESSAGES.payment_method, 422);
      }
    }
    const response = NextResponse.json({ order: outcome.order } satisfies CheckoutOrderResponse, { headers: NO_STORE });
    if (outcome.access) setCheckoutCookie(response, outcome.access);
    return response;
  } catch (error) {
    console.error("[checkout] No se pudo preparar el pedido:", error);
    return checkoutError("server", CHECKOUT_MESSAGES.server, 502);
  }
}
