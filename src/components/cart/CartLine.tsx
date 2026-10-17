"use client";

import type { Ref } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { Trash2 } from "lucide-react";
import { dismissible, transitions } from "@/lib/motion";
import { formatPrice } from "@/lib/utils";
import { TickingPrice } from "./TickingPrice";
import { IconButton, QuantitySelector } from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import type { CartItem } from "@/types";

interface CartLineProps {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  /** Eager-load the picture (the first lines, above the fold). */
  priority?: boolean;
  /** Forwarded so AnimatePresence's popLayout can measure the row as it leaves. */
  ref?: Ref<HTMLLIElement>;
}

/**
 * One line of the cart page: picture, name, unit price, quantity stepper,
 * line total and remove. The row slides into place when a sibling leaves
 * (layout) and leaves to the left when removed. The line total ticks when
 * the quantity changes. On phones the picture shrinks and the controls wrap
 * under the name, so nothing overflows at 320px.
 */
export function CartLine({ item, onQuantityChange, onRemove, priority = false, ref }: CartLineProps) {
  const lineTotal = item.price * item.quantity;
  const titleId = `cart-line-${item.id}`;

  return (
    <m.li
      ref={ref}
      layout
      variants={dismissible}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ layout: transitions.spring }}
      aria-labelledby={titleId}
      className="flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card sm:gap-5 sm:p-4"
      data-testid="cart-item"
    >
      <Link
        href={`/item/${item.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="group relative size-20 shrink-0 overflow-hidden rounded-xl bg-bg-subtle sm:size-28"
      >
        <ProductImage
          src={item.image}
          alt=""
          fill
          sizes="(max-width: 640px) 80px, 112px"
          loading={priority ? "eager" : "lazy"}
          className="object-contain p-2 transition-[scale] duration-slow ease-emphasized group-hover:scale-105"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id={titleId} className="text-body leading-snug font-semibold">
              <Link
                href={`/item/${item.id}`}
                className="line-clamp-2 rounded-sm text-fg hover:text-info"
                data-testid="cart-item-name"
              >
                {item.name}
              </Link>
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted tabular-nums">
              <span className="sr-only">Precio unitario: </span>
              {formatPrice(item.price)} c/u
            </p>
          </div>
          <IconButton
            label={`Eliminar ${item.name} del carrito`}
            size="icon-sm"
            className="-mt-1 -mr-1 shrink-0 hover:text-danger"
            onClick={onRemove}
            data-remove-line={item.id}
          >
            <Trash2 aria-hidden="true" />
          </IconButton>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <QuantitySelector
            value={item.quantity}
            onValueChange={onQuantityChange}
            max={item.stock}
            size="sm"
            label={`Cantidad de ${item.name}`}
          />
          <p className="flex items-baseline gap-1.5 text-fg">
            <span className="text-caption text-fg-muted">Subtotal</span>
            <TickingPrice value={lineTotal} className="text-lg font-bold" data-testid="cart-line-total" />
          </p>
        </div>
        {item.quantity >= item.stock ? (
          <p className="text-caption font-medium text-warning">Máximo disponible: {item.stock}</p>
        ) : null}
      </div>
    </m.li>
  );
}
