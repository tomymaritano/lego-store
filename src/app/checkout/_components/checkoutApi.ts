import type { CheckoutError, CheckoutOrderResponse, OrderView, PayResponse } from "@/lib/orders/types";
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
  return { ok: false, code: body?.code ?? "server", error: body?.error ?? NETWORK_ERROR.error, unavailable: body?.unavailable };
}

export interface PrepareRequest {
  shipping: ShippingInfo;
  lines: { productId: string; quantity: number }[];
  confirmationTokenId: string;
}

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
