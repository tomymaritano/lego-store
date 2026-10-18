import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { payOrder } from "@/lib/orders/checkout";
import {
  CHECKOUT_MESSAGES,
  NO_STORE,
  checkoutError,
  crossSite,
  gatewayOr503,
  jsonBody,
  mercadoPagoOr503,
  rateLimited,
  requesterOf,
} from "@/lib/orders/http";
import { payMercadoPagoOrder, type MercadoPagoPayOutcome } from "@/lib/orders/mercadopago";
import { afterMercadoPagoPayment } from "@/lib/orders/payment-effects";
import type { MercadoPagoPayResponse, PayResponse } from "@/lib/orders/types";
import { rateLimits } from "@/lib/rate-limit";
import { orderIdSchema, payMercadoPagoOrderSchema, payOrderSchema } from "@/lib/validations/orders";

/**
 * POST /api/checkout/orders/<id>/pay: "Realizar pedido". The only call that
 * charges; the amount is always the order's, computed when it was prepared.
 *
 * Stripe, body { confirmationTokenId }: confirms the order's PaymentIntent
 * with the token. 200 { next: "done" } paid (or processing; the order becomes
 * PAID with Stripe's webhook) · 200 { next: "action", clientSecret } the bank
 * wants 3D Secure: the browser runs stripe.handleNextAction.
 *
 * Mercado Pago, body { mercadopago: { attemptId, method, formData? } }:
 * creates the payment from the Payment Brick's formData (card or cash).
 * 200 { next: "done", order } approved (PAID), or taken and waiting
 * (PAYMENT_PENDING: a cash ticket, a card under review) · 200 { next:
 * "redirect", url } "Cuenta de Mercado Pago": the browser goes to pay there.
 *
 * Both: 402 declined (with the reason) · 422 the payment data has to be
 * entered again · 409 sold out / not payable · 404 not this browser's order ·
 * 429 · 503 not configured.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const refused = crossSite(request);
  if (refused) return refused;

  const id = orderIdSchema.safeParse((await params).orderId);
  const raw = await jsonBody(request);
  const mercadopago = payMercadoPagoOrderSchema.safeParse(raw);
  const stripe = mercadopago.success ? null : payOrderSchema.safeParse(raw);
  if (!id.success || (!mercadopago.success && !stripe?.success)) return checkoutError("invalid", CHECKOUT_MESSAGES.invalid, 400);

  const payments = mercadopago.success ? mercadoPagoOr503() : gatewayOr503();
  if ("response" in payments) return payments.response;

  const requester = await requesterOf(request);
  const limited = await rateLimited(rateLimits.checkoutPay, request, requester);
  if (limited) return limited;

  try {
    const db = getDb();
    const outcome =
      "mp" in payments
        ? await payMercadoPagoOrder(db, payments.mp, id.data, mercadopago.data!.mercadopago, requester)
        : await payOrder(db, payments.gateway, id.data, stripe!.data!.confirmationTokenId, requester);
    if (outcome.ok) {
      if (outcome.next === "action") {
        return NextResponse.json({ next: "action", clientSecret: outcome.clientSecret, order: outcome.order } satisfies PayResponse, { headers: NO_STORE });
      }
      if (outcome.next === "redirect") {
        return NextResponse.json({ next: "redirect", url: outcome.url, order: outcome.order } satisfies MercadoPagoPayResponse, { headers: NO_STORE });
      }
      if ("applied" in outcome) await afterMercadoPagoPayment(db, (outcome as Extract<MercadoPagoPayOutcome, { next: "done" }>).applied);
      // After the emails: the order the browser shows is the committed one either way.
      return NextResponse.json({ next: "done", order: outcome.order } satisfies PayResponse, { headers: NO_STORE });
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
