"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Eye, Heart, Scale } from "lucide-react";
import { hoverLift } from "@/lib/motion";
import { flyToCart } from "@/lib/flyToCart";
import { PLACEHOLDER_IMAGE, calculateDiscount, cn } from "@/lib/utils";
import { useProductActions } from "@/hooks/useProductActions";
import { Badge, IconButton, Price, Rating, cardVariants } from "@/components/ui";
import { AddToCartButton } from "./AddToCartButton";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  /** Eager-load the image (first row above the fold). */
  priority?: boolean;
}

/**
 * Catalogue card. The title link is stretched over the whole card, so the
 * card is one big click target without nesting buttons inside a link; the
 * action buttons sit above it. Actions show on hover / keyboard focus and are
 * always visible on touch screens.
 */
export function ProductCard({ product, onQuickView, priority = false }: ProductCardProps) {
  const { inWishlist, inCompare, isAvailable, toggleWishlist, toggleCompare } = useProductActions(product);
  const imageRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);
  const [secondaryError, setSecondaryError] = useState(false);
  const showSecondary = Boolean(product.imageSecondary) && !imageError && !secondaryError;

  const discounted = product.isOnSale && product.originalPrice ? product.originalPrice : undefined;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const titleId = `${useId()}-title`;

  return (
    <motion.article
      {...hoverLift}
      aria-labelledby={titleId}
      className={cn(
        cardVariants({ elevation: "raised" }),
        "group relative flex h-full flex-col overflow-hidden",
        "transition-[box-shadow,scale] duration-base ease-standard hover:shadow-xl focus-within:shadow-xl",
        // Press feedback when the card's link (its whole surface) is pressed.
        "motion-safe:has-[[data-testid=product-name]:active]:scale-98"
      )}
      data-testid="product-card"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-bg-subtle">
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5">
          {product.isNew && <Badge variant="new">Nuevo</Badge>}
          {discounted && (
            <Badge variant="sale">
              <span className="sr-only">Descuento de </span>-{calculateDiscount(discounted, product.price)}%
            </Badge>
          )}
          {product.highlight === "Edición Limitada" && <Badge variant="limited">Limitado</Badge>}
          {product.highlight === "Exclusivos" && <Badge variant="exclusive">Exclusivo</Badge>}
        </div>

        <div
          className={cn(
            "absolute top-3 right-3 z-20 flex flex-col gap-2",
            "transition-[opacity,translate] duration-base ease-standard",
            "translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
            "group-focus-within:translate-x-0 group-focus-within:opacity-100",
            "pointer-coarse:translate-x-0 pointer-coarse:opacity-100"
          )}
        >
          <IconButton
            label={inWishlist ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}
            aria-pressed={inWishlist}
            variant="secondary"
            size="icon-sm"
            onClick={toggleWishlist}
            className={cn("shadow-md", inWishlist && "border-sale text-sale")}
          >
            <Heart aria-hidden="true" className={cn(inWishlist && "fill-current")} />
          </IconButton>
          {onQuickView && (
            <IconButton
              label={`Vista rápida de ${product.name}`}
              variant="secondary"
              size="icon-sm"
              onClick={() => onQuickView(product)}
              className="shadow-md"
            >
              <Eye aria-hidden="true" />
            </IconButton>
          )}
          <IconButton
            label={inCompare ? `Quitar ${product.name} de la comparación` : `Comparar ${product.name}`}
            aria-pressed={inCompare}
            variant="secondary"
            size="icon-sm"
            onClick={toggleCompare}
            className={cn("shadow-md", inCompare && "border-info text-info")}
          >
            <Scale aria-hidden="true" />
          </IconButton>
        </div>

        <div className="absolute inset-0 p-6">
          <div ref={imageRef} className="relative size-full">
            <Image
              src={imageError ? PLACEHOLDER_IMAGE : product.img}
              alt=""
              fill
              preload={priority}
              className={cn(
                "object-contain transition-[scale,opacity] duration-slow ease-emphasized group-hover:scale-105",
                showSecondary && "group-hover:opacity-0"
              )}
              onError={() => setImageError(true)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            {showSecondary && (
              <Image
                src={product.imageSecondary!}
                alt=""
                fill
                onError={() => setSecondaryError(true)}
                className="object-contain opacity-0 transition-[scale,opacity] duration-slow ease-emphasized group-hover:scale-105 group-hover:opacity-100"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            )}
          </div>
        </div>

        {!isAvailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-overlay">
            <Badge variant="neutral" className="px-4 py-1.5 text-label">
              Agotado
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-caption font-semibold tracking-wider text-info uppercase">{product.theme}</p>

        <h3 id={titleId} className="text-body leading-snug font-bold">
          <Link
            href={`/item/${product.id}`}
            className="line-clamp-2 rounded-sm text-fg outline-none after:absolute after:inset-0 after:z-0 after:content-[''] group-hover:text-info focus-visible:ring-2 focus-visible:ring-focus-ring"
            data-testid="product-name"
          >
            {product.name}
          </Link>
        </h3>

        <Rating value={product.rating} showValue size="sm" />

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price value={product.price} originalValue={discounted} size="md" data-testid="product-price" />
          {lowStock && <span className="text-caption font-semibold text-warning">¡Solo quedan {product.stock}!</span>}
        </div>

        <AddToCartButton
          product={product}
          onAdded={() => flyToCart(imageRef.current, imageError ? PLACEHOLDER_IMAGE : product.img)}
          className="relative z-10 mt-2 w-full"
        />
      </div>
    </motion.article>
  );
}
