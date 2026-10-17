/**
 * Order pricing rules shared by the cart drawer, the cart page, checkout and
 * the info pages (and, later, the backend when it prices an order). Pure and
 * serializable: amounts are plain numbers in the store currency (ARS).
 */

/** Flat shipping rate for orders below FREE_SHIPPING_FROM. */
export const SHIPPING_COST = 299;
/** Orders whose subtotal reaches this amount ship free. */
export const FREE_SHIPPING_FROM = 5000;

interface ShippingQuote {
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

export interface OrderTotals {
  subtotal: number;
  shipping: ShippingQuote;
  total: number;
  /** Units in the order. */
  count: number;
}

/** Shipping for a subtotal: flat rate below the threshold, free from it on. */
export function quoteShipping(
  subtotal: number,
  { freeFrom = FREE_SHIPPING_FROM, cost = SHIPPING_COST }: { freeFrom?: number; cost?: number } = {}
): ShippingQuote {
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

/** Subtotal, shipping and total for a set of order lines. */
export function orderTotals(lines: readonly PricedLine[]): OrderTotals {
  const subtotal = linesSubtotal(lines);
  const shipping = quoteShipping(subtotal);
  return {
    subtotal,
    shipping,
    total: subtotal + shipping.cost,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
