"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, m } from "motion/react";
import { gridItem, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";

// The quick-view dialog loads on demand (first hover/focus on the grid
// preloads it) and stays mounted after the first open so it can animate out.
const loadQuickView = () => import("./QuickViewModal");
const QuickViewModal = dynamic(() => loadQuickView().then((mod) => mod.QuickViewModal), { ssr: false });

export interface ProductGridProps {
  products: Product[];
  /**
   * "mount": the server-rendered cards show straight away (no hidden content
   * before hydration); cards added later (next page, new filter result)
   * stagger in. "in-view": every card rises in as it scrolls into view (for
   * grids below the fold).
   */
  reveal?: "mount" | "in-view";
  /** Cards per batch (page size): each batch staggers on its own. */
  batchSize?: number;
  /** Cards whose image loads eagerly (first row above the fold). */
  eagerCount?: number;
  columns?: 3 | 4;
  /**
   * Phones only: "carousel" turns the single column into a horizontal,
   * snapping row (short showcase rows on the home page), so a 4-card row
   * does not become four screens of scrolling. From sm up it is the grid.
   */
  mobileLayout?: "stack" | "carousel";
  /** Previous results while new ones load: dimmed and marked busy. */
  busy?: boolean;
  /** Accessible name of the list, e.g. "12 productos". */
  label?: string;
  className?: string;
}

const COLUMNS = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
} as const;

const MOBILE = {
  stack: { list: "grid grid-cols-1", item: "" },
  carousel: {
    list: "-mx-4 flex snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain px-4 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0",
    item: "w-[80%] shrink-0 snap-start sm:w-auto",
  },
} as const;

/**
 * Product cards in a responsive grid with the quick-view dialog. Cards that
 * stay when the list changes glide to their new place (layout animation),
 * removed ones shrink away and new ones rise in.
 */
export function ProductGrid({
  products,
  reveal = "mount",
  batchSize = products.length || 1,
  eagerCount = 0,
  columns = 4,
  mobileLayout = "stack",
  busy = false,
  label,
  className,
}: ProductGridProps) {
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [quickViewMounted, setQuickViewMounted] = useState(false);
  if (quickView && !quickViewMounted) setQuickViewMounted(true);

  return (
    <>
      <ul
        aria-label={label}
        aria-busy={busy || undefined}
        onPointerEnter={() => void loadQuickView()}
        onFocus={() => void loadQuickView()}
        className={cn(
          MOBILE[mobileLayout].list,
          "gap-4 sm:grid md:gap-6",
          // Cards leaving a filtered list (popLayout lifts them out of the flow)
          // sit under the ones gliding into place and no longer take clicks.
          "[&>[data-motion-pop-id]]:pointer-events-none [&>[data-motion-pop-id]]:z-0",
          COLUMNS[columns],
          "transition-opacity duration-base ease-standard",
          busy && "opacity-60",
          className
        )}
      >
        <AnimatePresence initial={reveal === "in-view"} mode="popLayout">
          {products.map((product, index) => (
            <m.li
              key={product.id}
              layout="position"
              custom={index % batchSize}
              variants={gridItem}
              initial="hidden"
              exit="exit"
              {...(reveal === "in-view"
                ? { whileInView: "visible", viewport: { once: true, amount: "some" } }
                : { animate: "visible" })}
              transition={{ layout: transitions.spring }}
              className={cn("relative z-1 h-full", MOBILE[mobileLayout].item)}
            >
              <ProductCard product={product} onQuickView={setQuickView} priority={index < eagerCount} />
            </m.li>
          ))}
        </AnimatePresence>
      </ul>

      {quickViewMounted ? (
        <QuickViewModal product={quickView} isOpen={!!quickView} onClose={() => setQuickView(null)} />
      ) : null}
    </>
  );
}
