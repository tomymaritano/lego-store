"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, ShoppingCart } from "lucide-react";
import { transitions } from "@/lib/motion";
import { useProductActions } from "@/hooks/useProductActions";
import { openCartDrawer } from "@/stores";
import { Button, type ButtonProps } from "@/components/ui";
import type { ProductSummary } from "@/types";

interface AddToCartButtonProps extends Pick<ButtonProps, "size" | "className"> {
  product: ProductSummary;
  /** Visible label before the product is in the cart. */
  addLabel?: string;
  /** Runs after a successful add (e.g. the fly-to-cart animation). */
  onAdded?: () => void;
}

/**
 * "Agregar al carrito" for cards and lists. Once the product is in the cart
 * the same button stays enabled and focused and becomes "Ver carrito" (opens
 * the cart drawer, which returns focus here on close), so keyboard and
 * screen-reader users never lose their place in the grid (a button that
 * disables itself drops focus to <body>). Only an out-of-stock
 * product renders a disabled button, which the user never activated.
 *
 * The label swap only animates once the visitor reaches for the button
 * (hover, focus or touch arms it). Changes that do not come from this button,
 * such as the persisted cart loading right after hydration, just re-render
 * the text: animating those raced the lazily loaded motion features and could
 * leave the old label on screen.
 */
export function AddToCartButton({
  product,
  addLabel = "Agregar al carrito",
  onAdded,
  size = "sm",
  className,
}: AddToCartButtonProps) {
  const { inCart, isAvailable, addToCart } = useProductActions(product);
  const state = !isAvailable ? "soldout" : inCart ? "in" : "out";
  const [armed, setArmed] = useState(false);
  const arm = () => setArmed(true);

  const label = (
    <>
      {inCart ? <Check aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />}
      {state === "soldout" ? "Agotado" : state === "in" ? "Ver carrito" : addLabel}
    </>
  );

  return (
    <Button
      onPointerEnter={arm}
      onFocus={arm}
      onClick={() => {
        if (inCart) openCartDrawer();
        else if (addToCart()) onAdded?.();
      }}
      disabled={!isAvailable}
      size={size}
      variant={inCart ? "secondary" : "primary"}
      className={className}
      data-testid="add-to-cart-btn"
      data-in-cart={inCart || undefined}
    >
      {armed ? (
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={state}
            className="inline-flex items-center gap-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={transitions.fast}
          >
            {label}
          </m.span>
        </AnimatePresence>
      ) : (
        <span className="inline-flex items-center gap-2">{label}</span>
      )}
    </Button>
  );
}
