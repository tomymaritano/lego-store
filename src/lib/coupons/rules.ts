import { STORE_TIME_ZONE } from "@/lib/argentina";
import type { CouponTerms, CouponType } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";

/*
 * What decides whether a coupon can be used, as pure functions (client-safe):
 * the server applies them (./server.ts) with the coupon row locked and the
 * counts of its uses; the browser only ever shows the server's verdict.
 */

/** Why a coupon cannot be used. */
export type CouponRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "min_subtotal"
  /** Every use of it is taken (maxRedemptions). */
  | "exhausted"
  /** This customer (account or email) used it as many times as it allows (maxPerUser). */
  | "per_customer";

/** The columns of a Coupon the rules read. */
export interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minSubtotal: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  maxPerUser: number | null;
  active: boolean;
}

/** Uses of a coupon that count toward its limits (live holds + REDEEMED: src/lib/coupons/server.ts). */
export interface CouponUses {
  total: number;
  /** By this customer: their account (and, when the payment is submitted, their email). */
  customer: number;
}

export const termsOf = (coupon: Pick<CouponRow, "code" | "type" | "value" | "minSubtotal">): CouponTerms => ({
  code: coupon.code,
  type: coupon.type,
  value: coupon.value,
  minSubtotal: coupon.minSubtotal,
});

/** Whether the coupon is on and within its dates (startsAt inclusive, expiresAt exclusive). */
export function windowRejection(coupon: Pick<CouponRow, "active" | "startsAt" | "expiresAt">, now: Date): CouponRejection | null {
  if (!coupon.active) return "inactive";
  if (coupon.startsAt && now < coupon.startsAt) return "not_started";
  if (coupon.expiresAt && now >= coupon.expiresAt) return "expired";
  return null;
}

/** Whether another use fits in its limits, given the uses it already has. */
export function limitRejection(coupon: Pick<CouponRow, "maxRedemptions" | "maxPerUser">, uses: CouponUses): CouponRejection | null {
  if (coupon.maxRedemptions !== null && uses.total >= coupon.maxRedemptions) return "exhausted";
  if (coupon.maxPerUser !== null && uses.customer >= coupon.maxPerUser) return "per_customer";
  return null;
}

/**
 * Everything but the minimum subtotal, which only blocks the order itself:
 * the cart accepts a coupon below it and says how much is missing.
 */
export function couponRejection(coupon: CouponRow, uses: CouponUses, now: Date): CouponRejection | null {
  return windowRejection(coupon, now) ?? limitRejection(coupon, uses);
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/** Characters a code may have once normalised. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;
export const COUPON_CODE_MAX = 32;

/** "  bienvenida10 " -> "BIENVENIDA10": codes are case-insensitive. */
export const normalizeCouponCode = (code: string) => code.trim().toUpperCase();

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: STORE_TIME_ZONE });

/** What the customer reads when a coupon is refused (tuteo, like the rest of the store). */
export function couponRejectionMessage(
  reason: CouponRejection,
  coupon?: { startsAt?: Date | string | null; expiresAt?: Date | string | null; minSubtotal?: number } | null,
  subtotal?: number
): string {
  const date = (value: Date | string | null | undefined) => (value ? dateFormat.format(new Date(value)) : null);
  switch (reason) {
    case "not_found":
      return "Ese código no existe. Revisa que esté bien escrito.";
    case "inactive":
      return "Este cupón ya no está disponible.";
    case "not_started": {
      const from = date(coupon?.startsAt);
      return from ? `Este cupón todavía no está vigente: puedes usarlo desde el ${from}.` : "Este cupón todavía no está vigente.";
    }
    case "expired": {
      // expiresAt is exclusive: the last valid day is the one before.
      const until = coupon?.expiresAt ? date(new Date(new Date(coupon.expiresAt).getTime() - 1)) : null;
      return until ? `Este cupón venció: era válido hasta el ${until}.` : "Este cupón venció.";
    }
    case "min_subtotal": {
      const min = coupon?.minSubtotal ?? 0;
      const missing = subtotal !== undefined ? Math.max(0, min - subtotal) : 0;
      return missing > 0
        ? `Este cupón es para compras desde ${formatPrice(min)}: te faltan ${formatPrice(missing)}.`
        : `Este cupón es para compras desde ${formatPrice(min)}.`;
    }
    case "exhausted":
      return "Este cupón ya alcanzó su límite de usos.";
    case "per_customer":
      return "Ya usaste este cupón todas las veces que permite.";
  }
}

/** "10% de descuento", "$ 500 de descuento". */
export function couponLabel(coupon: Pick<CouponTerms, "type" | "value">): string {
  return coupon.type === "PERCENT" ? `${coupon.value}% de descuento` : `${formatPrice(coupon.value)} de descuento`;
}
