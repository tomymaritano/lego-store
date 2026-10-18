"use client";

import { AnimatePresence, m, type Variants } from "motion/react";
import { transitions } from "@/lib/motion";
import type { OrderView } from "@/lib/orders/types";
import type { OrderTotals as PricedTotals } from "@/lib/pricing";
import { cn, formatPrice, pluralize } from "@/lib/utils";
import { TickingPrice } from "./TickingPrice";

/** The amounts a totals block shows: from lib/pricing (cart, checkout) or from the server's order. */
export interface TotalsView {
  subtotal: number;
  /** Units in the order (shown next to the subtotal). */
  count: number;
  discount: number;
  couponCode: string | null;
  shipping: number;
  freeShipping: boolean;
  total: number;
}

/** lib/pricing's totals (orderTotals) as the block shows them. */
export function totalsView(totals: PricedTotals): TotalsView {
  return {
    subtotal: totals.subtotal,
    count: totals.count,
    discount: totals.discount,
    couponCode: totals.discount > 0 ? (totals.coupon?.code ?? null) : null,
    shipping: totals.shipping.cost,
    freeShipping: totals.shipping.free,
    total: totals.total,
  };
}

/** A server order's amounts (what it was priced and charged at). */
export function orderTotalsView(order: Pick<OrderView, "subtotal" | "discount" | "couponCode" | "shipping" | "total" | "items">): TotalsView {
  return {
    subtotal: order.subtotal,
    count: order.items.reduce((sum, item) => sum + item.quantity, 0),
    discount: order.discount,
    couponCode: order.couponCode,
    shipping: order.shipping,
    freeShipping: order.shipping === 0,
    total: order.total,
  };
}

/**
 * The discount row opens in place. The list spaces its rows with a bottom
 * margin (space-y-3), so the row animates that margin too: no 12px jump when
 * it appears or leaves.
 */
const discountRow: Variants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0 },
  visible: { opacity: 1, height: "auto", marginBottom: "0.75rem", transition: transitions.base },
  exit: { opacity: 0, height: 0, marginBottom: 0, transition: transitions.exit },
};

interface OrderTotalsProps {
  totals: TotalsView;
  /** Prefix for the data-testid of each amount: `${prefix}-subtotal|discount|shipping|total`. */
  testIdPrefix?: string;
  className?: string;
}

/**
 * Subtotal, coupon discount, shipping and total as a description list. The
 * cart page and checkout both render this, so the pricing rules
 * (lib/pricing) and the way they read never drift apart. Amounts tick when
 * they change; the discount row opens and closes in place.
 */
export function OrderTotals({ totals, testIdPrefix = "order", className }: OrderTotalsProps) {
  return (
    <dl className={cn("space-y-3 text-label font-normal", className)}>
      <div className="flex justify-between gap-4">
        <dt className="text-fg-secondary">Subtotal ({pluralize(totals.count, "producto")})</dt>
        <dd className="text-fg">
          <TickingPrice value={totals.subtotal} data-testid={`${testIdPrefix}-subtotal`} />
        </dd>
      </div>
      <AnimatePresence initial={false}>
        {totals.discount > 0 ? (
          // The animated element is the dt/dd group itself: a dl's groups are its direct div children.
          <m.div
            key="discount"
            variants={discountRow}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex justify-between gap-4 overflow-hidden"
          >
            <dt className="text-fg-secondary">
              Descuento
              {totals.couponCode ? <span className="ml-1 font-mono text-caption text-fg-muted">({totals.couponCode})</span> : null}
            </dt>
            <dd className="font-semibold text-success">
              <span aria-hidden="true">−</span>
              <span className="sr-only">menos </span>
              <TickingPrice value={totals.discount} data-testid={`${testIdPrefix}-discount`} />
            </dd>
          </m.div>
        ) : null}
      </AnimatePresence>
      <div className="flex justify-between gap-4">
        <dt className="text-fg-secondary">Envío</dt>
        <dd data-testid={`${testIdPrefix}-shipping`} className={totals.freeShipping ? "font-semibold text-success" : "text-fg tabular-nums"}>
          {totals.freeShipping ? "Gratis" : formatPrice(totals.shipping)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
        <dt className="text-body font-bold text-fg">Total</dt>
        <dd className="text-title text-fg">
          <TickingPrice value={totals.total} data-testid={`${testIdPrefix}-total`} />
        </dd>
      </div>
    </dl>
  );
}
