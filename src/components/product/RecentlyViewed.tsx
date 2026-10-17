"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { transitions } from "@/lib/motion";
import { useRecentlyViewedIds, useRecentlyViewedStore } from "@/stores";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { IconButton, Price } from "@/components/ui";

/** Records a product visit. Render it on the product page; re-runs per product. */
export function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    useRecentlyViewedStore.getState().addItem(productId);
  }, [productId]);
  return null;
}

const SCROLL_STEP = 280;
const STAGGER = 0.04;
const MAX_STAGGER = 0.2;

/**
 * Horizontal strip of the last products the visitor opened. The store keeps
 * only ids; products come fresh from /api/products/by-ids.
 */
export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const ids = useRecentlyViewedIds();
  const visibleIds = excludeId ? ids.filter((id) => id !== excludeId) : ids;
  const { products } = useProductsByIds(visibleIds);
  const scrollRef = useRef<HTMLUListElement>(null);

  if (products.length === 0) return null;

  const scroll = (direction: -1 | 1) =>
    scrollRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: "smooth" });

  return (
    <section aria-labelledby="recently-viewed-title" className="bg-bg-subtle py-12">
      <div className="container-custom">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-bg-muted text-info">
              <Clock className="size-5" />
            </span>
            <div>
              <h2 id="recently-viewed-title" className="text-title">
                Vistos recientemente
              </h2>
              <p className="text-sm text-fg-muted">Continúa donde lo dejaste</p>
            </div>
          </div>

          <div className="flex gap-2">
            <IconButton label="Desplazar a la izquierda" variant="secondary" onClick={() => scroll(-1)}>
              <ChevronLeft aria-hidden="true" />
            </IconButton>
            <IconButton label="Desplazar a la derecha" variant="secondary" onClick={() => scroll(1)}>
              <ChevronRight aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        <ul ref={scrollRef} className="-mx-4 flex gap-4 overflow-x-auto scroll-smooth px-4 pt-1 pb-4 scrollbar-hide">
          {products.map((product, index) => (
            <motion.li
              key={product.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0, transition: { ...transitions.base, delay: Math.min(index * STAGGER, MAX_STAGGER) } }}
              className="w-48 shrink-0"
            >
              <Link
                href={`/item/${product.id}`}
                className="group block overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-[box-shadow,translate] duration-base ease-standard hover:-translate-y-1 hover:shadow-md motion-reduce:hover:translate-y-0"
              >
                <div className="relative aspect-square bg-bg-subtle">
                  <Image
                    src={product.img}
                    alt=""
                    fill
                    sizes="192px"
                    className="object-contain p-3 transition-[scale] duration-slow ease-emphasized group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <p className="text-caption font-semibold text-info uppercase">{product.theme}</p>
                  <h3 className="mt-1 line-clamp-1 text-sm font-medium text-fg">{product.name}</h3>
                  <Price value={product.price} size="sm" className="mt-1" />
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
