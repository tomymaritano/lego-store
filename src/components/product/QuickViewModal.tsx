"use client";

import { useRef, useState } from "react";
import { ProductImage } from "./ProductImage";
import Link from "next/link";
import { Heart, ShoppingCart, ExternalLink } from "lucide-react";
import type { Product } from "@/types";
import { ProductThumbnails, useGalleryImages } from "./ProductThumbnails";
import { useProductActions } from "@/hooks/useProductActions";
import { CategoryName } from "@/providers/CategoriesProvider";
import { flyToCart } from "@/lib/flyToCart";
import { calculateDiscount, cn } from "@/lib/utils";
import { openCartDrawer, useCartStore } from "@/stores";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Price,
  QuantitySelector,
  Rating,
} from "@/components/ui";

interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Product preview in an accessible Dialog (focus trap, Escape, focus return). */
export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  // Keep showing the last product while the exit transition runs.
  const [shown, setShown] = useState(product);
  if (product && product !== shown) setShown(product);

  return (
    <Dialog open={isOpen && !!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 md:max-h-[90vh]">
        {shown ? <QuickViewBody key={shown.id} product={shown} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function QuickViewBody({ product, onClose }: { product: Product; onClose: () => void }) {
  const [quantity, setQuantity] = useState(1);
  const imageRef = useRef<HTMLDivElement>(null);

  const { inWishlist, isAvailable, addToCart, toggleWishlist } = useProductActions(product);
  const inCartQuantity = useCartStore((state) => state.cart.find((line) => line.id === product.id)?.quantity ?? 0);
  // What can still be added without going over the stock.
  const remaining = Math.max(0, product.stock - inCartQuantity);
  const cartIsFull = isAvailable && remaining === 0;
  const gallery = useGalleryImages([product.img, product.imageSecondary].filter((src): src is string => Boolean(src)));
  const discounted = product.isOnSale && product.originalPrice;

  const handleAddToCart = () => {
    if (cartIsFull) {
      // Every unit is already in the cart: show it instead (the dialog closes first).
      onClose();
      openCartDrawer();
      return;
    }
    if (addToCart(Math.min(quantity, remaining))) {
      flyToCart(imageRef.current, gallery.selectedSrc);
      setQuantity(1);
    }
  };

  return (
    <div className="flex flex-col overflow-y-auto md:flex-row">
      {/* Images */}
      <div className="bg-bg-subtle p-6 md:w-1/2">
        <div ref={imageRef} className="relative aspect-square overflow-hidden rounded-xl bg-surface">
          <ProductImage src={gallery.selectedSrc} alt={product.name} fill sizes="(min-width: 768px) 24rem, 100vw" className="object-contain p-4" />
          {discounted ? (
            <Badge variant="sale" className="absolute top-3 left-3">
              -{calculateDiscount(product.originalPrice!, product.price)}%
            </Badge>
          ) : null}
        </div>

        <ProductThumbnails
          images={gallery.images}
          selected={gallery.selected}
          onSelect={gallery.select}
          onImageError={gallery.markFailed}
          productName={product.name}
          size="sm"
          className="mt-4 justify-center"
        />
      </div>

      {/* Info */}
      <div className="flex flex-col p-6 md:w-1/2">
        <span className="text-caption font-semibold tracking-wider text-info uppercase">{product.theme}</span>
        <DialogTitle className="mt-2 pr-8 text-heading">{product.name}</DialogTitle>

        <Rating className="mt-3" value={product.rating} showValue />

        <Price className="mt-4" size="lg" value={product.price} originalValue={discounted ? product.originalPrice : undefined} />

        {product.description && (
          <DialogDescription className="mt-4 line-clamp-3 text-label font-normal text-fg-secondary">{product.description}</DialogDescription>
        )}

        <dl className="mt-4 space-y-2 text-label font-normal">
          {product.pieces && (
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-fg-muted">Piezas</dt>
              <dd className="font-medium text-fg">{product.pieces}</dd>
            </div>
          )}
          <div className="flex justify-between border-b border-border py-2">
            <dt className="text-fg-muted">Categoría</dt>
            <dd className="font-medium text-fg">
              <CategoryName id={product.category} />
            </dd>
          </div>
          <div className="flex justify-between border-b border-border py-2">
            <dt className="text-fg-muted">Disponibilidad</dt>
            <dd className={cn("font-medium", product.stock > 0 ? "text-success" : "text-danger")}>
              {product.stock > 0 ? `${product.stock} en stock` : "Agotado"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex items-center gap-3">
          <span className="text-label text-fg-secondary">Cantidad</span>
          <QuantitySelector
            value={quantity}
            onValueChange={setQuantity}
            max={Math.max(1, remaining)}
            label={`Cantidad de ${product.name}`}
            disabled={!isAvailable || cartIsFull}
          />
        </div>

        <div className="mt-6 space-y-3">
          {/* Stays enabled once the product is in the cart, so focus never drops to <body>. */}
          <Button onClick={handleAddToCart} disabled={!isAvailable} className="w-full" size="lg" data-testid="quick-view-add">
            <ShoppingCart aria-hidden="true" />
            {!isAvailable ? "Agotado" : cartIsFull ? "Ver carrito" : "Agregar al carrito"}
          </Button>
          {inCartQuantity > 0 ? (
            <p className="text-center text-label font-normal text-fg-secondary">
              Ya tienes {inCartQuantity} en el carrito
            </p>
          ) : null}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={toggleWishlist}
              aria-pressed={inWishlist}
              className={cn("flex-1", inWishlist && "border-sale text-sale")}
            >
              <Heart aria-hidden="true" className={cn(inWishlist && "fill-current")} />
              {inWishlist ? "En favoritos" : "Favoritos"}
            </Button>

            <Button variant="ghost" className="flex-1" render={<Link href={`/item/${product.id}`} onClick={onClose} />}>
              <ExternalLink aria-hidden="true" />
              Ver detalles
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
