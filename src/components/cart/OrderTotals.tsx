"use client";

import { quoteShipping } from "@/lib/pricing";
import { cn, formatPrice, pluralize } from "@/lib/utils";
import { TickingPrice } from "./TickingPrice";

interface OrderTotalsProps {
  subtotal: number;
  /** Units in the order (shown next to the subtotal). */
  count: number;
  /** Prefix for the data-testid of each amount: `${prefix}-subtotal|shipping|total`. */
  testIdPrefix?: string;
  className?: string;
}

/**
 * Subtotal, shipping and total as a description list. The cart page and
 * checkout both render this, so the shipping rule (lib/pricing) and the way
 * it reads never drift apart. Amounts tick when they change.
 */
export function OrderTotals({ subtotal, count, testIdPrefix = "order", className }: OrderTotalsProps) {
  const shipping = quoteShipping(subtotal);
  return (
    <dl className={cn("space-y-3 text-sm", className)}>
      <div className="flex justify-between gap-4">
        <dt className="text-fg-secondary">Subtotal ({pluralize(count, "producto")})</dt>
        <dd className="text-fg">
          <TickingPrice value={subtotal} data-testid={`${testIdPrefix}-subtotal`} />
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-fg-secondary">Envío</dt>
        <dd
          data-testid={`${testIdPrefix}-shipping`}
          className={shipping.free ? "font-semibold text-success" : "text-fg tabular-nums"}
        >
          {shipping.free ? "Gratis" : formatPrice(shipping.cost)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
        <dt className="text-body font-bold text-fg">Total</dt>
        <dd className="text-title text-fg">
          <TickingPrice value={subtotal + shipping.cost} data-testid={`${testIdPrefix}-total`} />
        </dd>
      </div>
    </dl>
  );
}
