"use client";

import { useCallback } from "react";
import { showToast } from "@/components/ui/Toast";
import {
  MAX_COMPARE_ITEMS,
  useCartStore,
  useCompareStore,
  useIsInCart,
  useIsInCompare,
  useIsInWishlist,
  useWishlistStore,
} from "@/stores";
import type { ProductSummary } from "@/types";

/** Toast copy for every product action, so all entry points say the same thing. */
export const productActionCopy = {
  addedToCart: (name: string, quantity: number) =>
    quantity > 1 ? `${quantity} × ${name} agregados al carrito` : `${name} agregado al carrito`,
  removedFromCart: (name: string) => `${name} eliminado del carrito`,
  outOfStock: (name: string) => `${name} está agotado`,
  addedToWishlist: (name: string) => `${name} agregado a favoritos`,
  removedFromWishlist: (name: string) => `${name} eliminado de favoritos`,
  addedToCompare: (name: string) => `${name} agregado a la comparación`,
  removedFromCompare: (name: string) => `${name} eliminado de la comparación`,
  compareFull: () => `Puedes comparar hasta ${MAX_COMPARE_ITEMS} productos`,
};

/**
 * Cart / wishlist / compare state and actions for one product, with toasts.
 * The single implementation behind ProductCard, QuickView, the product page,
 * CompareButton, the compare page and the wishlist.
 *
 * Accepts a ProductSummary, so a stored snapshot (wishlist) works as well as a
 * full Product. State flags are false until the stores are hydrated.
 */
export function useProductActions(product: ProductSummary) {
  const inCart = useIsInCart(product.id);
  const inWishlist = useIsInWishlist(product.id);
  const inCompare = useIsInCompare(product.id);
  const isAvailable = product.stock > 0;

  const addToCart = useCallback(
    (quantity = 1) => {
      if (product.stock <= 0) {
        showToast.error(productActionCopy.outOfStock(product.name));
        return false;
      }
      useCartStore.getState().addItem(product, quantity);
      showToast.cart(productActionCopy.addedToCart(product.name, quantity));
      return true;
    },
    [product]
  );

  const removeFromCart = useCallback(() => {
    useCartStore.getState().removeItem(product.id);
    showToast.info(productActionCopy.removedFromCart(product.name));
  }, [product]);

  const toggleWishlist = useCallback(() => {
    const added = useWishlistStore.getState().toggleWishlist(product);
    showToast.wishlist(
      added ? productActionCopy.addedToWishlist(product.name) : productActionCopy.removedFromWishlist(product.name),
      added
    );
    return added;
  }, [product]);

  const toggleCompare = useCallback(() => {
    const result = useCompareStore.getState().toggleCompare(product.id);
    if (result === "added") showToast.success(productActionCopy.addedToCompare(product.name));
    else if (result === "removed") showToast.info(productActionCopy.removedFromCompare(product.name));
    else showToast.warning(productActionCopy.compareFull());
    return result;
  }, [product]);

  return { inCart, inWishlist, inCompare, isAvailable, addToCart, removeFromCart, toggleWishlist, toggleCompare };
}
