import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, formatOrderDate, formatOrderNumber } from "@/lib/orders/format";
import type { OrderSummary } from "@/lib/orders/queries";
import { formatPrice, pluralize } from "@/lib/utils";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge } from "@/components/ui";

/**
 * One row of "Mis pedidos": number, date, status, a few line pictures and the
 * total. The whole card is the link to the order (named by its number).
 */
export function OrderCard({ order }: { order: OrderSummary }) {
  const number = formatOrderNumber(order.number);
  // Other products (lines), not units: 3 × the same set is one product.
  const others = order.lineCount > 1 ? ` y ${pluralize(order.lineCount - 1, "producto")} más` : "";
  return (
    <Link
      href={`/account/orders/${order.id}`}
      data-testid="order-card"
      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-fast ease-standard outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-focus-ring sm:p-5"
    >
      <span className="hidden shrink-0 -space-x-3 sm:flex" aria-hidden="true">
        {order.images.map((image, index) => (
          <span key={`${image}-${index}`} className="relative size-14 overflow-hidden rounded-xl bg-bg-subtle ring-2 ring-surface">
            <ProductImage src={image} alt="" fill sizes="56px" className="object-contain p-1" />
          </span>
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono font-semibold text-fg">
            <span className="sr-only">Pedido </span>
            {number}
          </span>
          <Badge variant={ORDER_STATUS_BADGE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
        </span>
        <span className="line-clamp-1 text-label font-normal text-fg-secondary">
          {order.firstItemName}
          {others}
        </span>
        <span className="text-caption text-fg-muted">{formatOrderDate(order.placedAt)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-body font-semibold text-fg tabular-nums">{formatPrice(order.total)}</span>
        <ChevronRight aria-hidden="true" className="size-5 text-fg-muted transition-[translate] duration-fast ease-standard group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
