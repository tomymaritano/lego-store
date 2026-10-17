"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { OrderTotals } from "./OrderTotals";

interface OrderSummaryProps {
  subtotal: number;
  /** Units in the cart. */
  count: number;
  className?: string;
}

/**
 * Cart page totals: subtotal, shipping ($299, free from $5000) with the
 * progress toward free shipping, total and the checkout CTA. Shipping comes
 * from lib/pricing (OrderTotals), the same rule the drawer and checkout use.
 */
export function OrderSummary({ subtotal, count, className }: OrderSummaryProps) {

  return (
    <Card className={className} aria-labelledby="order-summary-title" role="region">
      <CardHeader>
        <h2 id="order-summary-title" className="text-title text-fg">
          Resumen del pedido
        </h2>
      </CardHeader>
      <CardContent className="space-y-5">
        <FreeShippingProgress subtotal={subtotal} className="rounded-xl bg-bg-subtle p-3" />

        <OrderTotals subtotal={subtotal} count={count} testIdPrefix="cart" />

        <div className="space-y-3">
          <Button className="w-full" size="lg" render={<Link href="/checkout" />} data-testid="cart-checkout-btn">
            Finalizar compra
            <ArrowRight aria-hidden="true" />
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
