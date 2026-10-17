"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fadeIn } from "@/lib/motion";
import { calculateDiscount } from "@/lib/utils";
import { Badge } from "@/components/ui";
import type { Product } from "@/types";
import { ImageZoom } from "./ImageZoom";
import { ProductThumbnails } from "./ProductThumbnails";

/** Product page gallery: zoomable main image, badges and thumbnails. */
export function ProductGallery({ product }: { product: Product }) {
  const images = product.images.length ? product.images : [product.img];
  const [selected, setSelected] = useState(0);
  const discounted = product.isOnSale && product.originalPrice;

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-bg-subtle">
        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
          {product.isNew && <Badge variant="new">Nuevo</Badge>}
          {discounted ? (
            <Badge variant="sale">
              <span className="sr-only">Descuento de </span>-{calculateDiscount(product.originalPrice!, product.price)}%
            </Badge>
          ) : null}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selected} variants={fadeIn} initial="hidden" animate="visible" exit="exit" className="absolute inset-0">
            <ImageZoom src={images[selected]} alt={product.name} className="absolute inset-0" />
          </motion.div>
        </AnimatePresence>
      </div>

      <ProductThumbnails images={images} selected={selected} onSelect={setSelected} productName={product.name} />
    </div>
  );
}
