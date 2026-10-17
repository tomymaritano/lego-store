import { siteConfig } from "@/config/site";

export interface ShippingQuote {
  /** Shipping charged for this subtotal (0 when free or the cart is empty). */
  cost: number;
  free: boolean;
  /** Amount still needed to reach free shipping (0 once reached). */
  remaining: number;
  /** 0..1 progress toward the free-shipping threshold. */
  progress: number;
}

/** Shipping for a cart subtotal under the store's commerce rules. */
export function quoteShipping(
  subtotal: number,
  { freeShippingThreshold, shippingCost } = siteConfig.commerce
): ShippingQuote {
  const total = Math.max(0, subtotal);
  const free = total >= freeShippingThreshold;
  return {
    cost: free || total === 0 ? 0 : shippingCost,
    free,
    remaining: free ? 0 : freeShippingThreshold - total,
    progress: Math.min(1, total / freeShippingThreshold),
  };
}
