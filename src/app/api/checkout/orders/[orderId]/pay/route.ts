import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { payOrder } from "@/lib/orders/checkout";
import { CHECKOUT_MESSAGES, NO_STORE, checkoutError, crossSite, gatewayOr503, jsonBody, rateLimited, requesterOf } from "@/lib/orders/http";
import type { PayResponse } from "@/lib/orders/types";
import { rateLimits } from "@/lib/rate-limit";
import { orderIdSchema, payOrderSchema } from "@/lib/validations/orders";

/**
 * POST /api/checkout/orders/<id>/pay: "Realizar pedido".
 * Body: { confirmationTokenId }. Confirms the order's PaymentIntent with the
 * token (on the server; the amount is the order's, computed when it was
 * prepared). The order becomes PAID when Stripe's webhook arrives.
 *
 * 200 { next: "done" } paid (or processing) · 200 { next: "action",
 * clientSecret } the bank wants 3D Secure: the browser runs
 * stripe.handleNextAction · 402 declined · 409 sold out / not payable ·
 * 404 not this browser's order · 429 · 503.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const refused = crossSite(request);
  if (refused) return refused;
  const payments = gatewayOr503();
  if ("response" in payments) return payments.response;

  const id = orderIdSchema.safeParse((await params).orderId);
  const body = payOrderSchema.safeParse(await jsonBody(request));
  if (!id.success || !body.success) return checkoutError("invalid", CHECKOUT_MESSAGES.invalid, 400);

  const requester = await requesterOf(request);
  const limited = await rateLimited(rateLimits.checkoutPay, request, requester);
  if (limited) return limited;

  try {
    const outcome = await payOrder(getDb(), payments.gateway, id.data, body.data.confirmationTokenId, requester);
    if (outcome.ok) {
      const payload: PayResponse =
        outcome.next === "action"
          ? { next: "action", clientSecret: outcome.clientSecret, order: outcome.order }
          : { next: "done", order: outcome.order };
      return NextResponse.json(payload, { headers: NO_STORE });
    }
    switch (outcome.code) {
      case "not_found":
        return checkoutError("not_found", CHECKOUT_MESSAGES.not_found, 404);
      case "not_pending":
        return checkoutError("not_pending", CHECKOUT_MESSAGES.not_pending, 409);
      case "unavailable":
        return checkoutError("unavailable", CHECKOUT_MESSAGES.unavailable, 409, { unavailable: outcome.unavailable });
      case "payment_method":
        return checkoutError("payment_method", outcome.message, 422);
      default:
        return checkoutError("declined", outcome.message, 402);
    }
  } catch (error) {
    console.error("[checkout] No se pudo confirmar el pago:", error);
    return checkoutError("server", CHECKOUT_MESSAGES.server, 502);
  }
}
