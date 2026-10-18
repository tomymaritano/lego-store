import { z } from "zod";
import { COUPON_CODE_MAX, COUPON_CODE_PATTERN, normalizeCouponCode } from "@/lib/coupons/rules";

export const COUPON_CODE_MESSAGE = "Usa entre 3 y 32 letras, números, guiones o guiones bajos, sin espacios.";

/**
 * A coupon code as a customer types it (cart, checkout): normalised (trimmed,
 * uppercase: codes are case-insensitive), then checked against the allowed
 * characters.
 */
export const couponCodeSchema = z
  .string()
  .max(COUPON_CODE_MAX + 20)
  .transform(normalizeCouponCode)
  .pipe(z.string().regex(COUPON_CODE_PATTERN, COUPON_CODE_MESSAGE));
