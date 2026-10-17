import { ChevronDown } from "lucide-react";
import { formatPrice, pluralize } from "@/lib/utils";
import { ProductImage } from "@/components/product/ProductImage";
import type { CartItem } from "@/types";

/** Compact "picture · name × qty · line total" rows (mobile summary bar, confirmation). */
export function OrderLines({ lines, label }: { lines: readonly CartItem[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {lines.map((line) => (
        <li key={line.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-photo-tile">
            <ProductImage src={line.image} alt="" fill sizes="48px" className="object-contain p-1" />
          </span>
          <span className="min-w-0 flex-1 text-left text-sm">
            <span className="line-clamp-1 font-medium text-fg">{line.name}</span>
            <span className="text-caption text-fg-muted">Cantidad: {line.quantity}</span>
          </span>
          <span className="text-sm font-semibold text-fg tabular-nums">{formatPrice(line.price * line.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Phones and tablets: the order total and its lines, collapsed above the form
 * so the amount is visible before the visitor fills anything in. The full
 * summary card still follows the form (and is the sidebar on desktop).
 */
export function MobileSummaryBar({ lines, total }: { lines: readonly CartItem[]; total: number }) {
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <details className="disclosure group mb-6 rounded-2xl border border-border bg-surface shadow-card lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
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
      <div className="border-t border-border px-4 py-3">
        <OrderLines lines={lines} label="Productos a comprar" />
      </div>
    </details>
  );
}
