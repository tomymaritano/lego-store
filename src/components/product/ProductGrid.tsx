"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gridItem, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { QuickViewModal } from "./QuickViewModal";

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
  /** Previous results while new ones load: dimmed and marked busy. */
  busy?: boolean;
  /** Accessible name of the list, e.g. "12 productos". */
  label?: string;
  className?: string;
}

const COLUMNS = {
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
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
  busy = false,
  label,
  className,
}: ProductGridProps) {
  const [quickView, setQuickView] = useState<Product | null>(null);

  return (
    <>
      <ul
        aria-label={label}
        aria-busy={busy || undefined}
        className={cn(
          "grid gap-4 md:gap-6",
          COLUMNS[columns],
          "transition-opacity duration-base ease-standard",
          busy && "opacity-60",
          className
        )}
      >
        <AnimatePresence initial={reveal === "in-view"} mode="popLayout">
          {products.map((product, index) => (
            <motion.li
              key={product.id}
              layout="position"
              custom={index % batchSize}
              variants={gridItem}
              initial="hidden"
              exit="exit"
              {...(reveal === "in-view"
                ? { whileInView: "visible", viewport: { once: true, margin: "0px 0px -64px" } }
                : { animate: "visible" })}
              transition={{ layout: transitions.spring }}
              className="h-full"
            >
              <ProductCard product={product} onQuickView={setQuickView} priority={index < eagerCount} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <QuickViewModal product={quickView} isOpen={!!quickView} onClose={() => setQuickView(null)} />
    </>
  );
}
