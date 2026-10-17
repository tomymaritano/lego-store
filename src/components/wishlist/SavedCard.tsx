"use client";

import { useRef, type Ref } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { gridItem, transitions } from "@/lib/motion";
import { flyToCart } from "@/lib/flyToCart";
import { cn, pluralize } from "@/lib/utils";
import { useCartQuantity, useCartStore } from "@/stores";
import { Badge, Button, IconButton, Price, cardVariants } from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import { atCartLimit, isFull, moveToCart, remove, type SavedProduct } from "./wishlistActions";

/**
 * One saved product: picture, theme, name, price, a note when units are
 * already in the cart, remove (undo toast) and "Mover al carrito" (flies the
 * picture to the cart). Disabled when sold out or the cart holds all the stock.
 */
export function SavedCard({ product, index, ref }: { product: SavedProduct; index: number; ref?: Ref<HTMLLIElement> }) {
  const imageRef = useRef<HTMLSpanElement>(null);
  const inCart = useCartQuantity(product.id);
  const available = product.stock > 0;
  const atLimit = useCartStore((state) => {
    const line = state.cart.find((entry) => entry.id === product.id);
    return available && !!line && isFull(line, product);
  });
  const titleId = `saved-${product.id}-title`;

  return (
    <m.li
      ref={ref}
      layout
      custom={index}
      variants={gridItem}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ layout: transitions.spring }}
      aria-labelledby={titleId}
      className={cn(cardVariants({ interactive: true }), "group relative flex flex-col overflow-hidden")}
      data-testid="wishlist-item"
    >
      <div className="relative aspect-[4/3] bg-bg-subtle">
        <Link href={`/item/${product.id}`} tabIndex={-1} aria-hidden="true" className="absolute inset-0 p-5">
          <span ref={imageRef} className="relative block size-full">
            <ProductImage
              src={product.img}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain transition-[scale] duration-slow ease-emphasized group-hover:scale-105"
            />
          </span>
        </Link>
        {!available ? (
          <Badge variant="neutral" className="absolute top-3 left-3">
            Agotado
          </Badge>
        ) : null}
        <IconButton
          label={`Quitar ${product.name} de favoritos`}
          variant="secondary"
          size="icon-sm"
          className="absolute top-3 right-3 shadow-md hover:text-danger"
          onClick={() => remove(product)}
          data-remove-saved={product.id}
        >
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.theme ? (
          <p className="text-caption font-semibold tracking-wider text-info uppercase">{product.theme}</p>
        ) : null}
        <h2 id={titleId} className="text-body leading-snug font-bold">
          <Link href={`/item/${product.id}`} className="line-clamp-2 rounded-sm text-fg hover:text-info">
            {product.name}
          </Link>
        </h2>
        {/* Above the price, so price and CTA stay on one line across the row. */}
        {inCart > 0 ? (
          <p className="text-caption text-fg-muted" data-testid="saved-in-cart">
            {atLimit ? atCartLimit : `Ya tienes ${pluralize(inCart, "unidad", "unidades")} en el carrito`}
          </p>
        ) : null}
        <Price value={product.price} originalValue={product.originalPrice} size="md" className="mt-auto pt-1" />
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={!available || atLimit}
          onClick={() => {
            const image = imageRef.current;
            if (moveToCart(product)) flyToCart(image, product.img);
          }}
          data-testid="move-to-cart-btn"
        >
          <ShoppingCart aria-hidden="true" />
          {!available ? "Agotado" : atLimit ? "Máximo en el carrito" : "Mover al carrito"}
        </Button>
      </div>
    </m.li>
  );
}
