import { positionIn, useCartStore, useWishlistStore } from "@/stores";
import { productActionCopy } from "@/hooks/useProductActions";
import { showToast } from "@/components/ui";
import type { CartItem, Product, ProductSummary, WishlistItem } from "@/types";

/*
 * Wishlist actions that span both stores (remove, move to the cart, move
 * everything), each with an undo toast that reverts exactly what it did.
 * Plain functions over the stores' getState(), so the cards stay
 * presentational.
 */

/** What a saved row shows: fresh catalogue data when loaded, the stored snapshot until then. */
export interface SavedProduct extends ProductSummary {
  theme?: string;
  originalPrice?: number;
}

export function toSaved(item: WishlistItem, product?: Product): SavedProduct {
  if (product) {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      img: product.img,
      stock: product.stock,
      theme: product.theme,
      originalPrice: product.isOnSale ? product.originalPrice : undefined,
    };
  }
  return { id: item.id, name: item.name, price: item.price, img: item.image, stock: item.stock };
}

/** Focus after a card leaves: the neighbour's remove button, or the heading. */
export function focusAfterRemoval(neighbourId: string | undefined) {
  requestAnimationFrame(() => {
    const next =
      neighbourId && document.querySelector<HTMLElement>(`[data-remove-saved="${CSS.escape(neighbourId)}"]`);
    (next || document.getElementById("wishlist-title"))?.focus();
  });
}

export const atCartLimit = "Ya tienes el máximo disponible en el carrito";

/** Takes an item out of the wishlist, remembering where it was so undo can put it back. */
function takeOut(id: string) {
  const { wishlist, removeFromWishlist, restoreItem } = useWishlistStore.getState();
  const at = positionIn(
    wishlist.map((item) => item.id),
    id
  );
  const item = wishlist[at.index];
  const neighbour = wishlist[at.index + 1] ?? wishlist[at.index - 1];
  removeFromWishlist(id);
  focusAfterRemoval(neighbour?.id);
  return () => item && restoreItem(item, at);
}

export function remove(product: SavedProduct) {
  const undo = takeOut(product.id);
  showToast.undo(productActionCopy.removedFromWishlist(product.name), undo);
}

/** The cart line already holds all the stock (the line's own, or the fresh catalogue figure). */
export const isFull = (line: CartItem, product: SavedProduct) => line.quantity >= Math.min(line.stock, product.stock);

const cartQuantity = (id: string) => useCartStore.getState().cart.find((line) => line.id === id)?.quantity ?? 0;

/** Adds one unit; returns how many units the cart really took (0 at the stock limit). */
function addOne(product: SavedProduct) {
  const before = cartQuantity(product.id);
  useCartStore.getState().addItem(product, 1);
  return cartQuantity(product.id) - before;
}

/**
 * Takes back `added` units of `id` (undo). Works on the cart as it is now, so
 * other lines, and changes made since, are kept.
 */
function takeBackFromCart(id: string, added: number) {
  const { setQuantity, removeItem } = useCartStore.getState();
  const current = cartQuantity(id);
  if (current === 0) return;
  if (current - added <= 0) removeItem(id);
  else setQuantity(id, current - added);
}

/**
 * Adds one unit to the cart and drops the product from the wishlist; undo
 * reverts both. When the cart already holds all the stock nothing is added,
 * so the product stays saved. Returns whether it moved.
 */
export function moveToCart(product: SavedProduct) {
  const added = addOne(product);
  if (added === 0) {
    showToast.info(atCartLimit);
    return false;
  }
  const undoWishlist = takeOut(product.id);
  showToast.undo(productActionCopy.movedToCart(product.name), () => {
    undoWishlist();
    takeBackFromCart(product.id, added);
  });
  return true;
}

/**
 * Moves every product the cart can still take. Undo takes back only those
 * units and puts only those items back in the list, so anything added to
 * either list since then stays.
 */
export function moveAllToCart(products: SavedProduct[]) {
  const moved = products.flatMap((product) => {
    const added = addOne(product);
    return added > 0 ? [{ id: product.id, added }] : [];
  });
  if (moved.length === 0) {
    showToast.info(atCartLimit);
    return;
  }

  const { wishlist, removeMany } = useWishlistStore.getState();
  const ids = wishlist.map((item) => item.id);
  const saved = moved.flatMap(({ id }) => {
    const item = wishlist.find((entry) => entry.id === id);
    return item ? [{ item, at: positionIn(ids, id) }] : [];
  });
  removeMany(moved.map(({ id }) => id));
  focusAfterRemoval(useWishlistStore.getState().wishlist[0]?.id);

  showToast.undo(productActionCopy.movedAllToCart(moved.length), () => {
    moved.forEach(({ id, added }) => takeBackFromCart(id, added));
    const { restoreItem } = useWishlistStore.getState();
    saved.forEach(({ item, at }) => restoreItem(item, at));
  });
}
