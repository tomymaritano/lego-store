import type { CouponQuote } from "@/lib/coupons/server";
import type { CheckoutError } from "@/lib/orders/types";

export type QuoteResult =
  | { ok: true; quote: CouponQuote }
  /** `refused`: the server said no to the coupon (code "coupon"); otherwise it could not be asked (offline, 429, 5xx). */
  | { ok: false; error: string; refused: boolean };

export const COUPON_NETWORK_ERROR = "No pudimos validar el cupón. Revisa tu conexión e inténtalo de nuevo.";

/** POST /api/checkout/coupon: the server checks the code and prices the lines. */
export async function requestCouponQuote(
  body: { code: string; lines: { productId: string; quantity: number }[]; recheck?: boolean; recheckToken?: string },
  signal?: AbortSignal
): Promise<QuoteResult> {
  try {
    const response = await fetch("/api/checkout/coupon", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    const data = (await response.json().catch(() => null)) as (CouponQuote & Partial<CheckoutError>) | null;
    if (response.ok && data?.coupon) return { ok: true, quote: data };
    return { ok: false, error: data?.error ?? COUPON_NETWORK_ERROR, refused: data?.code === "coupon" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, error: COUPON_NETWORK_ERROR, refused: false };
  }
}
