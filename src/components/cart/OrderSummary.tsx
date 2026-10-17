"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { quoteShipping } from "@/lib/shipping";
import { formatPrice, pluralize } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { TickingPrice } from "./TickingPrice";

interface OrderSummaryProps {
  subtotal: number;
  /** Units in the cart. */
  count: number;
  className?: string;
}

/**
 * Cart page totals: subtotal, shipping ($299, free from $5000) with the
 * progress toward free shipping, total and the checkout CTA. Shipping comes
 * from quoteShipping(), the same rule the drawer and checkout use.
 */
export function OrderSummary({ subtotal, count, className }: OrderSummaryProps) {
  const shipping = quoteShipping(subtotal);

  return (
    <Card className={className} aria-labelledby="order-summary-title" role="region">
      <CardHeader>
        <h2 id="order-summary-title" className="text-title text-fg">
          Resumen del pedido
        </h2>
      </CardHeader>
      <CardContent className="space-y-5">
        <FreeShippingProgress subtotal={subtotal} className="rounded-xl bg-bg-subtle p-3" />

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-fg-secondary">Subtotal ({pluralize(count, "producto")})</dt>
            <dd className="text-fg">
              <TickingPrice value={subtotal} data-testid="cart-subtotal" />
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-secondary">Envío</dt>
            <dd data-testid="cart-shipping" className={shipping.free ? "font-semibold text-success" : "text-fg tabular-nums"}>
              {shipping.free ? "Gratis" : formatPrice(shipping.cost)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <dt className="text-body font-bold text-fg">Total</dt>
            <dd className="text-title text-fg">
              <TickingPrice value={subtotal + shipping.cost} data-testid="cart-total" />
            </dd>
          </div>
        </dl>

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
