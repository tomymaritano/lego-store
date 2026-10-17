"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { fadeIn } from "@/lib/motion";
import { linesSubtotal } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { ProductImage } from "@/components/product/ProductImage";
import { OrderTotals } from "@/components/cart/OrderTotals";
import { Card, CardContent, CardHeader, Spinner } from "@/components/ui";
import type { CartItem } from "@/types";

interface OrderSummaryProps {
  lines: CartItem[];
  /** While the payment runs the totals dim behind a spinner. */
  isProcessing?: boolean;
}

/**
 * Checkout sidebar: the lines being bought and the same totals block the cart
 * page shows (OrderTotals, lib/pricing), so the amounts always agree.
 */
/**
 * True while the element's content is taller than the element, so a scroll
 * container joins the tab order only when there is something to scroll
 * (WCAG 2.1.1: keyboard users must be able to reach it).
 */
function useOverflowsY<T extends HTMLElement>(contentKey: unknown) {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [contentKey]);

  return [ref, overflows] as const;
}

export function OrderSummary({ lines, isProcessing = false }: OrderSummaryProps) {
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const [listRef, listScrolls] = useOverflowsY<HTMLUListElement>(lines.length);

  return (
    <Card role="region" aria-labelledby="checkout-summary-title" className="lg:sticky lg:top-24">
      <CardHeader>
        <h2 id="checkout-summary-title" className="text-title text-fg">
          Resumen del pedido
        </h2>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* pt-2/pr-2 keep the quantity badges (offset outside each thumbnail) clear of the scroll clip. */}
        <ul
          ref={listRef}
          aria-label="Productos del pedido"
          tabIndex={listScrolls ? 0 : undefined}
          data-testid="checkout-lines"
          className="-mt-2 max-h-72 space-y-3 overflow-y-auto rounded-lg pt-2 pr-2"
        >
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3" data-testid="checkout-line">
              <span className="relative size-16 shrink-0 rounded-lg bg-photo-tile">
                <ProductImage src={line.image} alt="" fill sizes="64px" className="object-contain p-1.5" />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-caption font-semibold text-bg">
                  <span className="sr-only">Cantidad: </span>
                  {line.quantity}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-sm font-medium text-fg">{line.name}</span>
                {line.quantity > 1 && (
                  <span className="text-caption text-fg-muted tabular-nums">
                    {line.quantity} × {formatPrice(line.price)}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-fg tabular-nums">{formatPrice(line.price * line.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="relative border-t border-border pt-4">
          <OrderTotals
            subtotal={linesSubtotal(lines)}
            count={count}
            testIdPrefix="checkout"
            className={isProcessing ? "opacity-50 transition-opacity duration-base" : "transition-opacity duration-base"}
          />
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="exit"
                aria-hidden="true"
                className="absolute inset-0 top-2 flex items-center justify-center gap-2 rounded-lg bg-surface/85 text-sm font-medium text-fg backdrop-blur-sm"
              >
                <Spinner className="size-5" />
                Procesando el pago…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ul className="space-y-2 border-t border-border pt-4 text-caption text-fg-muted">
          <li className="flex items-center gap-2">
            <Lock aria-hidden="true" className="size-4 shrink-0" />
            Pago seguro y cifrado
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            Productos originales LEGO
          </li>
          <li className="flex items-center gap-2">
            <RotateCcw aria-hidden="true" className="size-4 shrink-0" />
            Devoluciones en {siteConfig.commerce.returnDays} días
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
