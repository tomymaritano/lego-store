"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Heart, Scale, Share2, ShoppingCart } from "lucide-react";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useProductActions } from "@/hooks/useProductActions";
import { Button, IconButton, QuantitySelector, showToast } from "@/components/ui";
import type { Product } from "@/types";

/** Product page actions: quantity, add to cart, wishlist, compare, share. */
export function ProductPurchase({ product }: { product: Product }) {
  const { inCart, inWishlist, inCompare, isAvailable, addToCart, toggleWishlist, toggleCompare } =
    useProductActions(product);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    if (addToCart(quantity)) setQuantity(1);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: `Mira este set de LEGO: ${product.name}`, url });
      } catch {
        // The user closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast.success("Enlace copiado al portapapeles");
    } catch {
      showToast.error("No se pudo copiar el enlace");
    }
  };

  return (
    <div className="space-y-5">
      {isAvailable && (
        <div className="flex items-center gap-4">
          <span className="text-label text-fg-secondary">
            Cantidad
          </span>
          <QuantitySelector
            value={quantity}
            onValueChange={setQuantity}
            max={product.stock}
            label={`Cantidad de ${product.name}`}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleAddToCart}
          disabled={!isAvailable}
          size="lg"
          className="min-w-56 flex-1"
          data-testid="add-to-cart-btn"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={inCart ? "in" : "out"}
              className="inline-flex items-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={transitions.fast}
            >
              {inCart ? <Check aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />}
              {!isAvailable ? "Agotado" : inCart ? "Agregar más al carrito" : "Agregar al carrito"}
            </motion.span>
          </AnimatePresence>
        </Button>

        <IconButton
          label={inWishlist ? "Quitar de favoritos" : "Agregar a favoritos"}
          aria-pressed={inWishlist}
          variant="secondary"
          className={cn("size-12", inWishlist && "border-sale text-sale")}
          onClick={toggleWishlist}
        >
          <Heart aria-hidden="true" className={cn(inWishlist && "fill-current")} />
        </IconButton>
        <IconButton
          label={inCompare ? "Quitar de la comparación" : "Agregar a la comparación"}
          aria-pressed={inCompare}
          variant="secondary"
          className={cn("size-12", inCompare && "border-info text-info")}
          onClick={toggleCompare}
        >
          <Scale aria-hidden="true" />
        </IconButton>
        <IconButton label="Compartir" variant="secondary" className="size-12" onClick={handleShare}>
          <Share2 aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}
