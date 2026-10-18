import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { MOCK_PROVIDER_COOKIE, checkoutProvider, getMercadoPago, getPaymentGateway } from "@/lib/payments/config";
import type { PaymentGateway } from "@/lib/payments/gateway";
import type { MercadoPagoClient } from "@/lib/payments/mercadopago/types";
import { clientIp, waitMessage, type RateLimiter } from "@/lib/rate-limit";
import { CHECKOUT_COOKIE, checkoutCookieOptions, parseCheckoutCookie, serializeCheckoutCookie, type CheckoutAccess, type Requester } from "./access";
import type { OrderPayments } from "./payments";
import type { CheckoutError, CheckoutErrorCode, PaymentProviderId, UnavailableLine } from "./types";

/*
 * What the checkout Route Handlers (src/app/api/checkout) share: who is
 * asking, the same-origin check, rate limits and the JSON error shape.
 * Checkout answers are per browser: never cached.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function checkoutError(code: CheckoutErrorCode, error: string, status: number, extra: { unavailable?: UnavailableLine[] } = {}) {
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

/** Reads a JSON body; null when it is not JSON. */
export async function jsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
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
