import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { MOCK_PROVIDER_COOKIE, checkoutProvider, getMercadoPago, getPaymentGateway } from "@/lib/payments/config";
import type { PaymentGateway } from "@/lib/payments/gateway";
import type { MercadoPagoClient } from "@/lib/payments/mercadopago/types";
import { clientIp, waitMessage, type RateLimiter } from "@/lib/rate-limit";
import { readTextCapped } from "@/lib/request-body";
import { CHECKOUT_COOKIE, checkoutCookieOptions, parseCheckoutCookie, serializeCheckoutCookie, type CheckoutAccess, type Requester } from "./access";
import type { OrderPayments } from "./payments";
import type { CheckoutError, CheckoutErrorCode, PaymentProviderId, UnavailableLine } from "./types";

/*
 * What the checkout Route Handlers (src/app/api/checkout) share: who is
 * asking, the same-origin check, rate limits and the JSON error shape.
 * Checkout answers are per browser: never cached.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function checkoutError(
  code: CheckoutErrorCode,
  error: string,
  status: number,
  extra: { unavailable?: UnavailableLine[]; rejection?: string } = {}
) {
  return NextResponse.json({ code, error, ...extra } satisfies CheckoutError, { status, headers: NO_STORE });
}

export const CHECKOUT_MESSAGES = {
  invalid: "Revisa los datos del pedido.",
  unavailable: "Algunos productos ya no tienen el stock que pediste. Actualizamos tu carrito.",
  payment_method: "Vuelve a ingresar los datos de la tarjeta.",
  /** The payment step was for the other provider (the store switched it meanwhile). */
  provider_changed: "Cambió el medio de pago de la tienda. Vuelve al paso de pago.",
  payments_unconfigured: "Los pagos no están configurados en este momento.",
  not_found: "No encontramos ese pedido.",
  not_pending: "Este pedido ya no se puede pagar.",
  server: "No pudimos procesar el pedido. Inténtalo de nuevo en unos minutos.",
} as const;

/** The signed-in user (if any) and this browser's checkout cookie (if any). */
export async function requesterOf(request: NextRequest): Promise<Requester> {
  const user = await getCurrentUser();
  return { userId: user?.id ?? null, access: parseCheckoutCookie(request.cookies.get(CHECKOUT_COOKIE)?.value) };
}

/**
 * Refuses a cross-site POST. Browsers send Origin on every POST; the checkout
 * cookie is SameSite=Lax anyway, this keeps a forged form from even
 * starting an order on a signed-in visitor's account.
 */
export function crossSite(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  let host: string | null = null;
  try {
    host = new URL(origin).host;
  } catch {
    // Unparseable Origin: refused below.
  }
  if (host && (host === request.nextUrl.host || host === request.headers.get("host"))) return null;
  return checkoutError("invalid", CHECKOUT_MESSAGES.invalid, 403);
}

export async function rateLimited(limiter: RateLimiter, request: NextRequest, requester: Requester): Promise<NextResponse | null> {
  const subject = requester.userId ? `user:${requester.userId}` : `ip:${clientIp(request.headers)}`;
  const result = await limiter.consume(subject);
  if (result.ok) return null;
  const response = checkoutError(
    "rate_limited",
    `Hiciste demasiados intentos. Espera ${waitMessage(result.retryAfterSeconds)} y vuelve a intentarlo.`,
    429
  );
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}

/** The gateway, or the 503 to answer when payments are not configured. */
export function gatewayOr503(): { gateway: PaymentGateway } | { response: NextResponse } {
  const gateway = getPaymentGateway();
  return gateway ? { gateway } : { response: checkoutError("payments_unconfigured", CHECKOUT_MESSAGES.payments_unconfigured, 503) };
}

export function setCheckoutCookie(response: NextResponse, access: CheckoutAccess) {
  response.cookies.set(CHECKOUT_COOKIE, serializeCheckoutCookie(access), checkoutCookieOptions());
}

/**
 * The largest checkout request body: the biggest real one (an order of
 * MAX_ORDER_LINES lines with its shipping data, or the Payment Brick's
 * formData) is a few kB.
 */
export const MAX_CHECKOUT_BODY_BYTES = 64 * 1024;

/**
 * Reads a JSON body with a byte cap (src/lib/request-body.ts), before any
 * validation, rate limit or session lookup: these routes are public, so an
 * unbounded body would let one client fill the server's memory. `body` is
 * null when it is not JSON (or the client aborted it); a body over the cap
 * is answered 413 without parsing it.
 */
export async function jsonBody(request: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  let text: string | null;
  try {
    text = await readTextCapped(request, MAX_CHECKOUT_BODY_BYTES);
  } catch {
    return { ok: true, body: null };
  }
  if (text === null) return { ok: false, response: checkoutError("invalid", "El pedido es demasiado grande.", 413) };
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: true, body: null };
  }
}

/** Mercado Pago's client, or the 503 to answer when it is not configured. */
export function mercadoPagoOr503(): { mp: MercadoPagoClient } | { response: NextResponse } {
  const mp = getMercadoPago();
  return mp ? { mp } : { response: checkoutError("payments_unconfigured", CHECKOUT_MESSAGES.payments_unconfigured, 503) };
}

/** Every configured provider's client (for code that may meet an order of either). */
export function appPayments(): OrderPayments {
  return { stripe: getPaymentGateway(), mercadopago: getMercadoPago() };
}

/** Who takes a new order from this request: PAYMENT_PROVIDER (or the mock-only test cookie). */
export function providerFor(request: NextRequest): PaymentProviderId {
  return checkoutProvider(process.env, request.cookies.get(MOCK_PROVIDER_COOKIE)?.value);
}
