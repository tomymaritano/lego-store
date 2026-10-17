import Image from "next/image";
import { Lock, Shield, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { CartItem } from "@/types";

interface OrderSummaryProps {
  cart: CartItem[];
  subtotal: number;
  shipping: number;
}

export function OrderSummary({ cart, subtotal, shipping }: OrderSummaryProps) {
  return (
    <aside
      aria-labelledby="order-summary-title"
      className="sticky top-24 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <h2 id="order-summary-title" className="mb-4 flex items-center gap-2 text-title">
        <ShoppingBag aria-hidden="true" className="size-5" />
        Resumen del pedido
      </h2>

      <ul className="mb-4 max-h-64 space-y-3 overflow-auto p-1">
        {cart.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span className="relative size-16 shrink-0 rounded-lg bg-bg-subtle">
              <Image src={item.image} alt="" fill sizes="64px" className="object-contain p-1" />
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-fg text-caption font-semibold text-bg">
                <span className="sr-only">Cantidad: </span>
                {item.quantity}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-1 text-sm font-medium text-fg">{item.name}</span>
              <span className="text-sm text-fg-muted tabular-nums">{formatPrice(item.price)}</span>
            </span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-fg-secondary">Subtotal</dt>
          <dd className="text-fg tabular-nums">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-secondary">Envío</dt>
          <dd className={shipping === 0 ? "font-semibold text-success" : "text-fg tabular-nums"}>
            {shipping === 0 ? "Gratis" : formatPrice(shipping)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-fg">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(subtotal + shipping)}</dd>
        </div>
      </dl>

      <ul className="mt-6 space-y-2 border-t border-border pt-4 text-sm text-fg-muted">
        <li className="flex items-center gap-2">
          <Lock aria-hidden="true" className="size-4" />
          Pago 100% seguro
        </li>
        <li className="flex items-center gap-2">
          <Shield aria-hidden="true" className="size-4" />
          Garantía de productos originales
        </li>
      </ul>
    </aside>
  );
}
