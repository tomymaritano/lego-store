"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Scale } from "lucide-react";
import { slideUp, transitions } from "@/lib/motion";
import { MAX_COMPARE_ITEMS, useCompareIds, useCompareStore } from "@/stores";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { Button } from "@/components/ui";
import { ProductImage } from "./ProductImage";

/** Routes where the bar would sit over the page's own primary actions or form fields. */
const HIDDEN_ON = ["/compare", "/cart", "/checkout"];

/**
 * Floating bar while products are queued for comparison. Hidden on /compare,
 * /cart and /checkout; elsewhere it flags <html> so globals.css reserves room
 * under the page and the bar never covers interactive content.
 */
export function CompareBar() {
  const pathname = usePathname();
  const ids = useCompareIds();
  const clearCompare = useCompareStore((state) => state.clearCompare);
  const { products } = useProductsByIds(ids, { onMissing: useCompareStore.getState().removeMany });
  const visible = ids.length > 0 && !HIDDEN_ON.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-compare-bar", visible);
    return () => root.removeAttribute("data-compare-bar");
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key="compare-bar"
          aria-label="Comparación de productos"
          variants={slideUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
        >
          <div className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3 text-fg shadow-xl sm:gap-4 sm:p-4">
            <p className="flex items-center gap-2 font-semibold whitespace-nowrap">
              <Scale aria-hidden="true" className="size-5 text-info" />
              <span aria-live="polite">
                {ids.length} de {MAX_COMPARE_ITEMS}
                <span className="sr-only"> productos para comparar</span>
              </span>
            </p>

            <ul className="hidden -space-x-2 sm:flex" aria-hidden="true">
              <AnimatePresence initial={false}>
                {products.map((product) => (
                  <motion.li
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={transitions.spring}
                    className="relative size-10 overflow-hidden rounded-full border-2 border-surface-raised bg-bg-muted"
                  >
                    <ProductImage src={product.img} alt="" fill sizes="40px" className="object-contain p-1" />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <div className="flex gap-2">
              <Button size="sm" render={<Link href="/compare" />}>
                Comparar
              </Button>
              <Button size="sm" variant="ghost" onClick={clearCompare}>
                Limpiar
              </Button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
