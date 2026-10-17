"use client";

import { AnimatePresence, motion } from "motion/react";
import { fadeIn } from "@/lib/motion";
import { calculateDiscount } from "@/lib/utils";
import { Badge } from "@/components/ui";
import type { Product } from "@/types";
import { ImageZoom } from "./ImageZoom";
import { ProductThumbnails, useGalleryImages } from "./ProductThumbnails";

/** Product page gallery: zoomable main image, badges and thumbnails. */
export function ProductGallery({ product }: { product: Product }) {
  const gallery = useGalleryImages(product.images.length ? product.images : [product.img]);
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
          <motion.div key={gallery.selectedSrc} variants={fadeIn} initial="hidden" animate="visible" exit="exit" className="absolute inset-0">
            <ImageZoom src={gallery.selectedSrc} alt={product.name} className="absolute inset-0" />
          </motion.div>
        </AnimatePresence>
      </div>

      <ProductThumbnails
        images={gallery.images}
        selected={gallery.selected}
        onSelect={gallery.select}
        onImageError={gallery.markFailed}
        productName={product.name}
      />
    </div>
  );
}
