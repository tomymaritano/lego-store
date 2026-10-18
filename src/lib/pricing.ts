/**
 * Order pricing rules shared by the cart drawer, the cart page, checkout and
 * the info pages, and by the server when it prices an order (the order it
 * stores, and the amount Mercado Pago or Stripe charge, come from
 * orderTotals). Pure and serializable: amounts are plain numbers in the store
 * currency (ARS, whole pesos).
 *
 * Shipping: a flat cost below a free-shipping threshold. Both are store
 * settings an admin changes (/admin/configuracion, src/lib/settings), so
 * every function takes the rules as an argument: the server reads them from
 * the database when it prices an order, the browser gets them from the root
 * layout (useShippingRules). DEFAULT_SHIPPING_RULES are what a new store
 * starts with (the seed, a database without its settings row, tests).
 *
 * Coupons (the rules the server enforces live in src/lib/coupons; this is
 * only the arithmetic, the same in the browser and on the server):
 * - PERCENT takes `value`% of the products' subtotal, rounded to whole pesos,
 *   half up (10% of $2.445 is $244.50 → $245).
 * - FIXED takes `value` pesos, never more than the subtotal.
 * - Below the coupon's minimum subtotal it takes nothing (`applies: false`,
 *   with what is missing).
 * - Shipping is never discounted. Free shipping is decided on the subtotal
 *   before the discount, so applying a coupon never brings shipping back;
 *   except when the coupon covers every product: the order then still pays
 *   shipping, because an order is never free (the payment providers cannot
 *   charge $0).
 */

/** The store's shipping rule (StoreSettings.shippingCost / freeShippingFrom). */
export interface ShippingRules {
  /**
   * Flat rate for orders below `freeFrom` (pesos, > 0: never free, so a coupon
   * that covers every product still leaves shipping to pay; a store that
   * ships everything free sets `freeFrom` to 1).
   */
  cost: number;
  /** Orders whose subtotal reaches this amount ship free (pesos, > 0). */
  freeFrom: number;
}

/** A new store's rule: $299, free from $5.000 (seed, missing settings row, tests). */
export const DEFAULT_SHIPPING_RULES: ShippingRules = Object.freeze({ cost: 299, freeFrom: 5000 });

export interface ShippingQuote {
  /** Shipping charged for this subtotal (0 when free or the cart is empty). */
  cost: number;
  free: boolean;
  /** Amount still needed to reach free shipping (0 once reached). */
  remaining: number;
  /** 0..1 progress toward the free-shipping threshold. */
  progress: number;
}

interface PricedLine {
  price: number;
  quantity: number;
}

export type CouponType = "PERCENT" | "FIXED";

/** What the discount math needs of a coupon (client-safe: no limits, no ids). */
export interface CouponTerms {
  /** Normalised (uppercase). */
  code: string;
  type: CouponType;
  /** PERCENT: 1..100. FIXED: pesos. */
  value: number;
  /** Smallest subtotal it applies to (pesos, before the discount); 0 = any. */
  minSubtotal: number;
}

export interface AppliedCoupon {
  code: string;
  /** False while the subtotal is under the coupon's minimum: no discount yet. */
  applies: boolean;
  /** What the subtotal is missing to reach that minimum (0 once it applies). */
  shortBy: number;
}

export interface OrderTotals {
  subtotal: number;
  /** Taken off the products by the coupon (0 without one). */
  discount: number;
  shipping: ShippingQuote;
  /** subtotal - discount + shipping. */
  total: number;
  /** Units in the order. */
  count: number;
  coupon: AppliedCoupon | null;
}

/** Shipping for a subtotal: flat rate below the threshold, free from it on. */
export function quoteShipping(subtotal: number, { freeFrom, cost }: ShippingRules): ShippingQuote {
  const total = Math.max(0, subtotal);
  const free = total >= freeFrom;
  return {
    cost: free || total === 0 ? 0 : cost,
    free,
    remaining: free ? 0 : freeFrom - total,
    progress: Math.min(1, total / freeFrom),
  };
}

/** Sum of price × quantity over the lines. */
export function linesSubtotal(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

/** `percent`% of `amount`, in whole pesos, rounded half up (integer math: no float drift). */
export function percentOf(amount: number, percent: number): number {
  return Math.floor((amount * percent + 50) / 100);
}

/** What the coupon takes off this subtotal (0 below its minimum or without a coupon). */
export function couponDiscount(subtotal: number, coupon: CouponTerms | null | undefined): number {
  if (!coupon || subtotal <= 0 || subtotal < coupon.minSubtotal) return 0;
  const raw = coupon.type === "PERCENT" ? percentOf(subtotal, Math.min(100, coupon.value)) : coupon.value;
  return Math.max(0, Math.min(subtotal, raw));
}

/** Subtotal, discount, shipping and total from a subtotal (see the rules above). */
export function totalsFor(subtotal: number, count: number, rules: ShippingRules, coupon: CouponTerms | null = null): OrderTotals {
  const discount = couponDiscount(subtotal, coupon);
  let shipping = quoteShipping(subtotal, rules);
  // Every product covered by the coupon: shipping is still charged (an order is never free).
  if (subtotal > 0 && discount >= subtotal && shipping.cost === 0) shipping = { ...shipping, cost: rules.cost, free: false };
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping.cost,
    count,
    coupon: coupon
      ? { code: coupon.code, applies: subtotal >= coupon.minSubtotal, shortBy: Math.max(0, coupon.minSubtotal - subtotal) }
      : null,
  };
}

/** Subtotal, discount, shipping and total for a set of order lines and, optionally, a coupon. */
export function orderTotals(lines: readonly PricedLine[], rules: ShippingRules, coupon: CouponTerms | null = null): OrderTotals {
  return totalsFor(
    linesSubtotal(lines),
    lines.reduce((sum, line) => sum + line.quantity, 0),
    rules,
    coupon
  );
}
