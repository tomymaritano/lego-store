import { ChevronDown } from "lucide-react";
import { formatPrice, pluralize } from "@/lib/utils";
import { CouponField, type CouponFieldProps } from "@/components/cart/CouponField";
import { OrderTotals, type TotalsView } from "@/components/cart/OrderTotals";
import { ProductImage } from "@/components/product/ProductImage";
import type { OrderView } from "@/lib/orders/types";
import type { CartItem } from "@/types";

/** An order's snapshot lines in the shape the line lists take. */
export function orderLinesOf(order: Pick<OrderView, "items">): CartItem[] {
  return order.items.map((item, index) => ({
    id: item.productId ?? `deleted-${index}`,
    name: item.name,
    price: item.unitPrice,
    image: item.image,
    quantity: item.quantity,
    stock: 0,
  }));
}

/** Compact "picture · name × qty · line total" rows (mobile summary bar, confirmation). */
export function OrderLines({ lines, label }: { lines: readonly CartItem[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {lines.map((line) => (
        <li key={line.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
            <ProductImage src={line.image} alt="" fill sizes="48px" className="object-contain p-1" />
          </span>
          <span className="min-w-0 flex-1 text-left text-label font-normal">
            <span className="line-clamp-1 font-medium text-fg">{line.name}</span>
            <span className="text-caption text-fg-muted">Cantidad: {line.quantity}</span>
          </span>
          <span className="text-label text-fg tabular-nums">{formatPrice(line.price * line.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Phones and tablets: the order summary, collapsed above the form so the
 * amount is visible before the visitor fills anything in; opened, it lists
 * the lines, the coupon field and the subtotal / discount / shipping /
 * total. It replaces the summary card, which only shows as the desktop
 * sidebar (no summary twice).
 */
export function MobileSummaryBar({
  lines,
  totals,
  coupon,
  disabled = false,
}: {
  lines: readonly CartItem[];
  totals: TotalsView;
  coupon: Omit<CouponFieldProps, "testIdPrefix" | "disabled">;
  disabled?: boolean;
}) {
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = totals.total;
  return (
    <details className="disclosure group mb-6 rounded-2xl border border-border bg-surface shadow-card lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-label focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="font-semibold text-fg">
          Ver resumen <span className="font-normal text-fg-muted">({pluralize(count, "producto")})</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-bold text-fg tabular-nums">{formatPrice(total)}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-fg-muted transition-[rotate] duration-base ease-standard group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-3">
        <OrderLines lines={lines} label="Productos a comprar" />
        <CouponField {...coupon} disabled={disabled} testIdPrefix="checkout-mobile" className="border-t border-border pt-4" />
        <OrderTotals
          totals={totals}
          testIdPrefix="checkout-mobile"
          className="border-t border-border pt-4"
        />
      </div>
    </details>
  );
}
