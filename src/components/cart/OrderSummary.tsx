"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { orderTotals } from "@/lib/pricing";
import { useCheckedCoupon } from "@/stores";
import type { CartItem } from "@/types";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { CouponField } from "./CouponField";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { OrderTotals, totalsView } from "./OrderTotals";
import { useCouponRecheck } from "./useCouponRecheck";

interface OrderSummaryProps {
  lines: CartItem[];
  className?: string;
}

/**
 * Cart page totals: subtotal, the coupon's discount, shipping ($299, free
 * from $5000) with the progress toward free shipping, total and the checkout
 * CTA. The amounts come from lib/pricing (orderTotals), the same rules the
 * drawer, checkout and the server use; the coupon field asks the server
 * whether a code applies, and again about the applied one when the page
 * loads (the discount counts once it answers). A secondary "Seguir comprando" link returns to the store.
 */
export function OrderSummary({ lines, className }: OrderSummaryProps) {
  useCouponRecheck();
  const coupon = useCheckedCoupon();
  const totals = orderTotals(lines, coupon);
  const subtotal = totals.subtotal;
  return (
    <Card className={className} aria-labelledby="order-summary-title" role="region">
      <CardHeader>
        <h2 id="order-summary-title" className="text-title text-fg">
          Resumen del pedido
        </h2>
      </CardHeader>
      <CardContent className="space-y-5">
        <FreeShippingProgress subtotal={subtotal} className="rounded-xl bg-bg-subtle p-3" />

        <CouponField lines={lines.map((line) => ({ productId: line.id, quantity: line.quantity }))} subtotal={subtotal} testIdPrefix="cart" />

        <OrderTotals totals={totalsView(totals)} testIdPrefix="cart" />

        <div className="space-y-3">
          <Button className="w-full" size="lg" render={<Link href="/checkout" />} data-testid="cart-checkout-btn">
            Finalizar compra
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="ghost" className="w-full" render={<Link href="/" />}>
            Seguir comprando
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-caption text-fg-muted">
            <Lock aria-hidden="true" className="size-3.5" />
            Pago seguro · Devoluciones en 30 días
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
