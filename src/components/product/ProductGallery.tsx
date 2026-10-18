"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { AnimatePresence, m, useIsPresent, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { gallerySlide } from "@/lib/motion";
import { calculateDiscount, cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Badge, IconButton } from "@/components/ui";
import type { Product } from "@/types";
import { ImageZoom } from "./ImageZoom";
import { ProductThumbnails, useGalleryImages } from "./ProductThumbnails";

/** Marks the stage so other islands (the buy box's fly-to-cart) can find the picture on screen. */
export const GALLERY_STAGE_ATTR = "data-gallery-stage";

/** A swipe counts once the finger travels this far or flicks this fast (px, px/s). */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

/** Main picture first, then the rest, without duplicates. */
export function gallerySources(product: Pick<Product, "img" | "images">): string[] {
  return Array.from(new Set([product.img, ...product.images].filter(Boolean)));
}

/** A picture's alt text: the one the admin wrote for it (Product.imageAlts), or the product's name. */
export function galleryAlt(product: Pick<Product, "name" | "images" | "imageAlts">, src: string): string {
  const index = product.images.indexOf(src);
  return (index >= 0 ? product.imageAlts?.[index]?.trim() : "") || product.name;
}

/**
 * Product page gallery: the zoomable main picture (ImageZoom), previous/next
 * buttons, a thumbnail strip and, on touch screens, swipe. Arrow keys work on
 * the main picture and on the thumbnails. Pictures slide in from the side
 * they come from (opacity only under reduced motion).
 */
export function ProductGallery({ product }: { product: Product }) {
  const gallery = useGalleryImages(gallerySources(product));
  const [direction, setDirection] = useState(1);
  const touch = useMediaQuery("(pointer: coarse)");
  const dragged = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Set when the keyboard changed the picture while focus was on it: focus follows to the new one. */
  const refocus = useRef(false);
  const count = gallery.images.length;
  const discounted = product.isOnSale && product.originalPrice;

  const show = (index: number, towards: number) => {
    if (index === gallery.selected) return;
    setDirection(towards);
    gallery.select(index);
  };
  const step = (delta: 1 | -1) => count > 1 && show((gallery.selected + delta + count) % count, delta);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // React events bubble out of portals: ignore keys pressed inside the zoom dialog.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta || count < 2) return;
    event.preventDefault();
    refocus.current = (event.target as HTMLElement).closest("[data-slide]") !== null;
    step(delta);
  };

  // The focused picture is about to leave (it is keyed by src): move focus to the incoming one.
  const selectedSrc = gallery.selectedSrc;
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const slides = stageRef.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? [];
    const incoming = Array.from(slides).find((slide) => slide.dataset.slide === selectedSrc);
    incoming?.querySelector<HTMLElement>("button")?.focus();
  }, [selectedSrc]);

  const handleDragEnd = (_: unknown, { offset, velocity }: PanInfo) => {
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) step(1);
    else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) step(-1);
  };

  // A swipe ends with a click on the picture: swallow it so it does not open the zoom.
  const swallowClickAfterDrag = (event: MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="space-y-4">
      <div
        ref={stageRef}
        {...{ [GALLERY_STAGE_ATTR]: "" }}
        onKeyDown={handleKeyDown}
        className="group/stage relative aspect-square overflow-hidden rounded-2xl border border-border bg-bg-subtle"
      >
        <div className="pointer-events-none absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
          {product.isNew && <Badge variant="new">Nuevo</Badge>}
          {discounted ? (
            <Badge variant="sale">
              <span className="sr-only">Descuento de </span>-{calculateDiscount(product.originalPrice!, product.price)}%
            </Badge>
          ) : null}
        </div>

        <AnimatePresence initial={false} custom={direction}>
          <m.div
            key={gallery.selectedSrc}
            data-slide={gallery.selectedSrc}
            custom={direction}
            variants={gallerySlide}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0"
            drag={touch && count > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            dragSnapToOrigin
            onDragStart={() => {
              dragged.current = true;
            }}
            onDragEnd={(event, info) => {
              handleDragEnd(event, info);
              // The click that ends a swipe arrives right after; forget the drag once it has passed.
              setTimeout(() => {
                dragged.current = false;
              }, 0);
            }}
            onClickCapture={swallowClickAfterDrag}
            style={touch && count > 1 ? { touchAction: "pan-y" } : undefined}
          >
            <Slide src={gallery.selectedSrc} alt={galleryAlt(product, gallery.selectedSrc)} />
          </m.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <IconButton
              label="Imagen anterior"
              variant="secondary"
              size="icon-sm"
              onClick={() => step(-1)}
              className={cn(navButton, "left-3")}
            >
              <ChevronLeft aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Imagen siguiente"
              variant="secondary"
              size="icon-sm"
              onClick={() => step(1)}
              className={cn(navButton, "right-3")}
            >
              <ChevronRight aria-hidden="true" />
            </IconButton>
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-4 z-20 rounded-full bg-surface-raised px-2.5 py-1 text-caption font-semibold text-fg tabular-nums shadow-sm"
            >
              {gallery.selected + 1} / {count}
            </span>
            <p className="sr-only" aria-live="polite">
              Imagen {gallery.selected + 1} de {count}
            </p>
          </>
        )}
      </div>

      <ProductThumbnails
        images={gallery.images}
        selected={gallery.selected}
        onSelect={(index) => show(index, index > gallery.selected ? 1 : -1)}
        onImageError={gallery.markFailed}
        productName={product.name}
      />
    </div>
  );
}

/** The zoomable picture; while it slides out it is inert, so only the incoming one can take focus or clicks. */
function Slide({ src, alt }: { src: string; alt: string }) {
  const present = useIsPresent();
  return (
    <div inert={!present} className="absolute inset-0">
      <ImageZoom src={src} alt={alt} className="absolute inset-0" />
    </div>
  );
}

/** Prev/next sit on the picture's edges; with a mouse they appear on hover or keyboard focus. */
const navButton = cn(
  "absolute top-1/2 z-20 size-10 -translate-y-1/2 bg-surface-raised shadow-md",
  "transition-[opacity,background-color,scale] duration-fast ease-standard",
  "pointer-fine:opacity-0 pointer-fine:group-hover/stage:opacity-100 pointer-fine:focus-visible:opacity-100"
);
