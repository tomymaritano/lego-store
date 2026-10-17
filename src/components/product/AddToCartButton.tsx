"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, ShoppingCart } from "lucide-react";
import { labelSwap } from "@/lib/motion";
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
 * The label swap animates only when this button adds the product: the swap
 * is keyed on those adds, not on the cart state. Other changes, such as the
 * persisted cart loading right after hydration, re-render the text in place
 * (animating those raced the lazily loaded motion features and could leave
 * the old label on screen).
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
  const [adds, setAdds] = useState(0);

  const label = (
    <>
      {inCart ? <Check aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />}
      {state === "soldout" ? "Agotado" : state === "in" ? "Ver carrito" : addLabel}
    </>
  );

  return (
    <Button
      onClick={() => {
        if (inCart) return openCartDrawer();
        if (!addToCart()) return;
        setAdds((count) => count + 1);
        onAdded?.();
      }}
      disabled={!isAvailable}
      size={size}
      variant={inCart ? "secondary" : "primary"}
      className={className}
      data-testid="add-to-cart-btn"
      data-in-cart={inCart || undefined}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={adds}
          className="inline-flex items-center gap-2"
          variants={labelSwap}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {label}
        </m.span>
      </AnimatePresence>
    </Button>
  );
}
