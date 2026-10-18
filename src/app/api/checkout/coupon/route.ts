import { NextResponse, type NextRequest } from "next/server";
import { quoteCoupon, type CouponQuote } from "@/lib/coupons/server";
import { getDb } from "@/lib/db";
import { CHECKOUT_MESSAGES, NO_STORE, checkoutError, crossSite, jsonBody, rateLimited, requesterOf } from "@/lib/orders/http";
import { rateLimits } from "@/lib/rate-limit";
import { couponQuoteSchema } from "@/lib/validations/coupons";
import { COUPON_CODE_MESSAGE } from "@/lib/validations/coupon-code";

/**
 * POST /api/checkout/coupon: "Aplicar" in the cart's or the checkout's
 * summary. Body: { code, lines: [{ productId, quantity }], email? }.
 * Checks the coupon (active, dates, limits, per customer: the signed-in
 * account and/or `email`) and prices the lines from the database. Reserves
 * nothing: the order does, when the checkout prepares it, and checks again.
 *
 * 200 { coupon: { code, type, value, minSubtotal, label }, totals } ·
 * 400 invalid · 422 code "coupon" with `rejection` and the reason in
 * Spanish · 429 (it is a guessable code: tries are limited per user or IP).
 */
export async function POST(request: NextRequest) {
  const refused = crossSite(request);
  if (refused) return refused;
  const body = await jsonBody(request);
  const parsed = couponQuoteSchema.safeParse(body);
  if (!parsed.success) {
    const badCode = parsed.error.issues.some((issue) => issue.path[0] === "code");
    return badCode ? checkoutError("coupon", COUPON_CODE_MESSAGE, 422, { rejection: "invalid" }) : checkoutError("invalid", CHECKOUT_MESSAGES.invalid, 400);
  }

  const requester = await requesterOf(request);
  const limited = await rateLimited(rateLimits.couponQuote, request, requester);
  if (limited) return limited;

  try {
    const outcome = await quoteCoupon(getDb(), {
      code: parsed.data.code,
      lines: parsed.data.lines,
      customer: { userId: requester.userId, email: parsed.data.email ?? null },
    });
    if (!outcome.ok) return checkoutError("coupon", outcome.message, 422, { rejection: outcome.rejection });
    return NextResponse.json(outcome.quote satisfies CouponQuote, { headers: NO_STORE });
  } catch (error) {
    console.error("[coupons] No se pudo validar el cupón:", error);
    return checkoutError("server", CHECKOUT_MESSAGES.server, 502);
  }
}
