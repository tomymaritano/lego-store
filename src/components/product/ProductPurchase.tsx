"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Check, Heart, PackageCheck, Scale, Share2, ShoppingCart } from "lucide-react";
import { collapse, transitions } from "@/lib/motion";
import { flyToCart } from "@/lib/flyToCart";
import { cn } from "@/lib/utils";
import { useProductActions } from "@/hooks/useProductActions";
import { useCartQuantity } from "@/stores";
import { Button, IconButton, QuantitySelector, showToast } from "@/components/ui";
import type { Product } from "@/types";
import { GALLERY_STAGE_ATTR } from "./ProductGallery";

/** At or below this many units the stock line turns into a "last units" warning. */
export const LOW_STOCK = 5;
/** How long the CTA says "¡Agregado!" after a successful add (ms). */
const ADDED_FEEDBACK_MS = 1800;

/** Stock line: in stock / last units / sold out, with a coloured dot (colour is never the only cue). */
export function StockStatus({ stock }: { stock: number }) {
  const tone = stock <= 0 ? "danger" : stock <= LOW_STOCK ? "warning" : "success";
  const label =
    stock <= 0
      ? "Agotado"
      : stock <= LOW_STOCK
        ? stock === 1
          ? "¡Última unidad disponible!"
          : `¡Últimas ${stock} unidades!`
        : `En stock · ${stock} unidades disponibles`;
  return (
    <p className="flex items-center gap-2 text-sm font-semibold" data-testid="stock-status">
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 shrink-0 rounded-full ring-4",
          tone === "danger" ? "bg-danger ring-danger/20" : tone === "warning" ? "bg-warning ring-warning/20" : "bg-success ring-success/20"
        )}
      />
      <span className={tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-success"}>{label}</span>
    </p>
  );
}

/**
 * Product page buy box: stock, quantity, add to cart (the picture flies to
 * the cart and the CTA confirms), wishlist, compare and share (Web Share API,
 * or copy the link with a toast). The quantity never exceeds what is left
 * after the units already in the cart.
 */
export function ProductPurchase({ product }: { product: Product }) {
  const { inWishlist, inCompare, isAvailable, addToCart, toggleWishlist, toggleCompare } = useProductActions(product);
  const inCartQuantity = useCartQuantity(product.id);
  const remaining = Math.max(0, product.stock - inCartQuantity);
  const [requested, setRequested] = useState(1);
  const quantity = Math.min(requested, Math.max(1, remaining));
  const [justAdded, setJustAdded] = useState(false);
  /** Bumped on each wishlist click so only the visitor's own toggle pops the heart. */
  const [heartPops, setHeartPops] = useState(0);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const handleAddToCart = () => {
    if (!addToCart(quantity)) return;
    const picture = document.querySelector<HTMLImageElement>(`[${GALLERY_STAGE_ATTR}] [data-slide] img`);
    flyToCart(picture, picture?.currentSrc || product.img);
    setRequested(1);
    setJustAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: product.name, text: `Mira este set de LEGO: ${product.name}`, url });
        return;
      } catch (error) {
        // The visitor closed the share sheet: nothing to do. Any other failure falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast.success("Enlace copiado al portapapeles");
    } catch {
      showToast.error("No se pudo copiar el enlace");
    }
  };

  const soldOut = !isAvailable;
  const maxedOut = isAvailable && remaining === 0;
  const ctaState = soldOut ? "sold-out" : justAdded ? "added" : maxedOut ? "maxed" : inCartQuantity > 0 ? "more" : "add";
  const ctaLabel = {
    "sold-out": "Agotado",
    added: "¡Agregado al carrito!",
    maxed: "Ya tienes todo el stock",
    more: "Agregar más al carrito",
    add: "Agregar al carrito",
  }[ctaState];

  return (
    <div>
      <div className="space-y-5">
        <StockStatus stock={product.stock} />

        {/* Stays (disabled) once the whole stock is in the cart, so the CTA below does not jump up. */}
        {isAvailable && (
          <div className="flex items-center gap-4">
            <span className="text-label text-fg-secondary">Cantidad</span>
            <QuantitySelector
              value={quantity}
              onValueChange={setRequested}
              max={Math.max(1, remaining)}
              disabled={maxedOut}
              label={`Cantidad de ${product.name}`}
            />
          </div>
        )}

        {/* Mobile: full-width CTA with the three secondary actions in their own row; sm+: one row. */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={handleAddToCart}
            disabled={soldOut || maxedOut}
            size="lg"
            className={cn("w-full sm:w-auto sm:flex-1", justAdded && "bg-success text-on-success hover:bg-success")}
            data-testid="add-to-cart-btn"
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={ctaState}
                className="inline-flex items-center gap-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={transitions.fast}
              >
                {ctaState === "added" || ctaState === "more" ? (
                  <Check aria-hidden="true" />
                ) : (
                  <ShoppingCart aria-hidden="true" />
                )}
                {ctaLabel}
              </m.span>
            </AnimatePresence>
          </Button>

          <div className="grid grid-cols-3 gap-3 sm:flex">
            <IconButton
              label={inWishlist ? "Quitar de favoritos" : "Agregar a favoritos"}
              aria-pressed={inWishlist}
              variant="secondary"
              className={cn(secondaryAction, inWishlist && "border-sale text-sale")}
              onClick={() => {
                toggleWishlist();
                setHeartPops((n) => n + 1);
              }}
            >
              <m.span
                key={heartPops}
                initial={heartPops ? { scale: 0.6 } : false}
                animate={{ scale: 1 }}
                transition={transitions.spring}
                className="inline-flex"
              >
                <Heart aria-hidden="true" className={cn(inWishlist && "fill-current")} />
              </m.span>
            </IconButton>
            <IconButton
              label={inCompare ? "Quitar de la comparación" : "Agregar a la comparación"}
              aria-pressed={inCompare}
              variant="secondary"
              className={cn(secondaryAction, inCompare && "border-info text-info")}
              onClick={toggleCompare}
            >
              <Scale aria-hidden="true" />
            </IconButton>
            <IconButton label="Compartir" variant="secondary" className={secondaryAction} onClick={handleShare}>
              <Share2 aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Below the actions, with an animated height: the CTA never moves under the pointer that just added. */}
      <AnimatePresence initial={false}>
        {inCartQuantity > 0 && (
          <m.div key="in-cart" variants={collapse} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
            <p className="flex items-center gap-2 pt-4 text-sm text-fg-secondary">
              <PackageCheck aria-hidden="true" className="size-4 shrink-0 text-info" />
              <span>
                Tienes {inCartQuantity} en tu carrito ·{" "}
                <Link href="/cart" className="font-semibold text-info underline-offset-4 hover:underline">
                  Ver carrito
                </Link>
              </span>
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Same height and radius as the CTA, so the row reads as one unit (full-width cells on mobile). */
const secondaryAction = "h-12 w-full rounded-lg sm:w-12";
