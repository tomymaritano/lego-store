import type { CheckoutError, CheckoutOrderResponse, MercadoPagoPayResponse, OrderView, PayResponse } from "@/lib/orders/types";
import type { ShippingInfo } from "@/types";

/*
 * The checkout's calls to its Route Handlers (src/app/api/checkout). Every
 * answer is either the data or a CheckoutError with a Spanish message; a
 * network failure becomes a "server" error too, so the steps handle one shape.
 */

export type ApiResult<T> = { ok: true; data: T } | ({ ok: false } & CheckoutError);

const NETWORK_ERROR: CheckoutError = {
  code: "server",
  error: "No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.",
};

async function call<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { ok: false, ...NETWORK_ERROR };
  }
  const body = (await response.json().catch(() => null)) as (T & Partial<CheckoutError>) | null;
  if (response.ok && body) return { ok: true, data: body };
  return {
    ok: false,
    code: body?.code ?? "server",
    error: body?.error ?? NETWORK_ERROR.error,
    unavailable: body?.unavailable,
    rejection: body?.rejection,
  };
}

/** Stripe sends the card's ConfirmationToken; Mercado Pago nothing about the payment yet. */
export type PrepareRequest = {
  shipping: ShippingInfo;
  lines: { productId: string; quantity: number }[];
  /** The applied coupon's code: the server validates it, reserves a use and prices the order with it. */
  couponCode?: string;
  /** The token the cart's quote returned for that code: a refusal then says the real reason. */
  couponToken?: string;
} & ({ confirmationTokenId: string } | { provider: "MERCADOPAGO" });

/** Entering "Revisar": the server prices the order and creates (or updates) it. */
export async function prepareOrder(request: PrepareRequest, signal?: AbortSignal): Promise<ApiResult<OrderView>> {
  const result = await call<CheckoutOrderResponse>("/api/checkout/orders", { method: "POST", body: JSON.stringify(request), signal });
  return result.ok ? { ok: true, data: result.data.order } : result;
}

/** "Realizar pedido". */
export function payOrder(orderId: string, confirmationTokenId: string): Promise<ApiResult<PayResponse>> {
  return call<PayResponse>(`/api/checkout/orders/${encodeURIComponent(orderId)}/pay`, {
    method: "POST",
    body: JSON.stringify({ confirmationTokenId }),
  });
}

/** The order's current state (the confirmation polls it until the payment settles). */
export async function fetchCheckoutOrder(orderId: string, signal?: AbortSignal): Promise<ApiResult<OrderView>> {
  const result = await call<CheckoutOrderResponse>(`/api/checkout/orders/${encodeURIComponent(orderId)}`, { signal });
  return result.ok ? { ok: true, data: result.data.order } : result;
}

export interface MercadoPagoPayRequest {
  attemptId: string;
  method: "card" | "ticket" | "wallet";
  formData?: Record<string, unknown>;
}

/** "Realizar pedido" for a Mercado Pago order: the Brick's data goes to the server only now. */
export function payMercadoPagoOrder(orderId: string, payment: MercadoPagoPayRequest): Promise<ApiResult<MercadoPagoPayResponse>> {
  return call<MercadoPagoPayResponse>(`/api/checkout/orders/${encodeURIComponent(orderId)}/pay`, {
    method: "POST",
    body: JSON.stringify({ mercadopago: payment }),
  });
}

/** Back from Mercado Pago: the server asks Mercado Pago how the order's payment stands. */
export async function syncCheckoutOrder(orderId: string, paymentId: string | null): Promise<ApiResult<OrderView>> {
  const result = await call<CheckoutOrderResponse>(`/api/checkout/orders/${encodeURIComponent(orderId)}/sync`, {
    method: "POST",
    body: JSON.stringify(paymentId ? { paymentId } : {}),
  });
  return result.ok ? { ok: true, data: result.data.order } : result;
}
