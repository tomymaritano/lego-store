"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Scale, X } from "lucide-react";
import { slideUp, transitions } from "@/lib/motion";
import { MAX_COMPARE_ITEMS, useCompareIds, useCompareStore } from "@/stores";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { useTuckOnScroll } from "@/hooks/useTuckOnScroll";
import { Button, IconButton } from "@/components/ui";
import { ProductImage } from "./ProductImage";

/** Routes where the bar would sit over the page's own primary actions or form fields. */
const HIDDEN_ON = ["/compare", "/cart", "/checkout"];

/**
 * Floating bar while products are queued for comparison. Hidden on /compare,
 * /cart and /checkout; elsewhere it flags <html> so globals.css reserves room
 * under the page and the bar never covers interactive content.
 *
 * It tucks away while the visitor scrolls down (useTuckOnScroll) and comes
 * back on scroll up, at the top and at the bottom of the page, so it does not
 * sit over the text being read. Tucked, it is inert; it never tucks while
 * keyboard focus is inside it. On phones it is a compact pill in the corner
 * instead of a full-width bar.
 */
export function CompareBar() {
  const pathname = usePathname();
  const ids = useCompareIds();
  const clearCompare = useCompareStore((state) => state.clearCompare);
  const { products } = useProductsByIds(ids, { onMissing: useCompareStore.getState().removeMany });
  const visible = ids.length > 0 && !HIDDEN_ON.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const [focusInside, setFocusInside] = useState(false);
  const tucked = useTuckOnScroll(visible) && !focusInside;

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-compare-bar", visible);
    return () => root.removeAttribute("data-compare-bar");
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <m.aside
          key="compare-bar"
          aria-label="Comparación de productos"
          variants={slideUp}
          initial="hidden"
          animate={tucked ? "hidden" : "visible"}
          exit="exit"
          inert={tucked}
          data-tucked={tucked || undefined}
          onFocus={() => setFocusInside(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocusInside(false);
          }}
          className="fixed right-4 bottom-4 z-50 sm:right-auto sm:left-1/2 sm:-translate-x-1/2"
        >
          <div className="flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border bg-surface-raised py-1.5 ps-4 pe-1.5 text-fg shadow-xl sm:gap-4 sm:rounded-2xl sm:p-4">
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
                  <m.li
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={transitions.spring}
                    className="relative size-10 overflow-hidden rounded-full border-2 border-surface-raised bg-bg-muted"
                  >
                    <ProductImage src={product.img} alt="" fill sizes="40px" className="object-contain p-1" />
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>

            <div className="flex items-center gap-1 sm:gap-2">
              <Button size="sm" className="rounded-full sm:rounded-lg" render={<Link href="/compare" />}>
                Comparar
              </Button>
              <Button size="sm" variant="ghost" onClick={clearCompare} className="hidden sm:inline-flex">
                Limpiar
              </Button>
              <IconButton label="Limpiar comparación" size="icon-sm" onClick={clearCompare} className="sm:hidden">
                <X aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
