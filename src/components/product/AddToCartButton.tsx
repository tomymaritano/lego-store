"use client";

import { AnimatePresence, motion } from "motion/react";
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
}

/**
 * "Agregar al carrito" for cards and lists. Once the product is in the cart
 * the same button stays enabled and focused and becomes "Ver carrito" (opens
 * the cart drawer, which returns focus here on close), so keyboard and
 * screen-reader users never lose their place in the grid (a button that
 * disables itself drops focus to <body>). Only an out-of-stock
 * product renders a disabled button, which the user never activated.
 */
export function AddToCartButton({ product, addLabel = "Agregar al carrito", size = "sm", className }: AddToCartButtonProps) {
  const { inCart, isAvailable, addToCart } = useProductActions(product);
  const state = !isAvailable ? "soldout" : inCart ? "in" : "out";

  return (
    <Button
      onClick={() => (inCart ? openCartDrawer() : addToCart())}
      disabled={!isAvailable}
      size={size}
      variant={inCart ? "secondary" : "primary"}
      className={className}
      data-testid="add-to-cart-btn"
      data-in-cart={inCart || undefined}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={transitions.fast}
        >
          {inCart ? <Check aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />}
          {state === "soldout" ? "Agotado" : state === "in" ? "Ver carrito" : addLabel}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
