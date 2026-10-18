"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addToCartAction,
  addToWishlistAction,
  clearCartAction,
  clearWishlistAction,
  mergeListsAction,
  removeFromCartAction,
  removeFromWishlistAction,
  setCartQuantityAction,
} from "@/lib/lists/actions";
import { planListsSync } from "@/lib/lists/sync-plan";
import type { ServerLists } from "@/lib/lists/types";
import { fetchProductsByIds } from "@/lib/api-client";
import { MAX_IDS_PER_REQUEST } from "@/lib/productQuery";
import { useViewer } from "@/providers/ViewerProvider";
import { useCartStore, useStoreHydrated, useWishlistStore } from "@/stores";
import { noWritesSince, setListsRemote, writeGeneration } from "@/stores/listsRemote";
import { showToast } from "@/components/ui";

/*
 * Keeps the browser's cart and wishlist in step with the account (see
 * src/lib/lists/sync-plan.ts for the rules):
 * - installs the server remote the stores send a signed-in user's changes to;
 * - once the stores have loaded localStorage, and again whenever the session
 *   changes: merges a visitor's lists into the account on login, reloads the
 *   account's lists (server truth: current prices and stock), clears the
 *   account's copy on logout;
 * - reloads the account's lists when the tab comes back into view (another
 *   device may have changed them);
 * - for a visitor, refreshes the cart's stored prices and stock from the
 *   catalogue.
 */

async function fetchServerLists(signal?: AbortSignal): Promise<ServerLists> {
  const response = await fetch("/api/lists", { signal, headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`GET /api/lists → ${response.status}`);
  return response.json() as Promise<ServerLists>;
}

function adopt(lists: ServerLists, owner: string) {
  useCartStore.getState().replaceCart(lists.cart, owner);
  useWishlistStore.getState().replaceWishlist(lists.wishlist, owner);
}

async function syncAccount(viewerId: string, isCurrent: () => boolean) {
  const cart = useCartStore.getState();
  const wishlist = useWishlistStore.getState();
  const plan = planListsSync(viewerId, { cart: cart.owner, wishlist: wishlist.owner });
  if (plan.kind !== "account") return;

  const guestCart = plan.mergeCart ? cart.cart.map((line) => ({ productId: line.id, quantity: line.quantity })) : [];
  const guestWishlist = plan.mergeWishlist ? wishlist.wishlist.map((item) => item.id) : [];

  if (plan.mergeCart || plan.mergeWishlist) {
    const result = await mergeListsAction({ cart: guestCart, wishlist: guestWishlist });
    if (!isCurrent()) return;
    // (Changes made meanwhile were local only, the lists had no owner yet: the merged lists replace them.)
    // A failed merge leaves the visitor's lists as they are: the next page load tries again.
    if (!result.ok) return;
    adopt(result.data, viewerId);
    if (guestCart.length + guestWishlist.length > 0) {
      showToast.info("Guardamos en tu cuenta lo que tenías en el carrito y en favoritos.");
    }
    return;
  }

  const generation = writeGeneration();
  const lists = await fetchServerLists();
  // A change made while the request was out is newer than this answer: keep the local copy.
  if (isCurrent() && noWritesSince(generation)) adopt(lists, viewerId);
}

function syncVisitor() {
  const cart = useCartStore.getState();
  const wishlist = useWishlistStore.getState();
  const plan = planListsSync(null, { cart: cart.owner, wishlist: wishlist.owner });
  if (plan.kind !== "visitor") return;
  // The lists of whoever was signed in leave with the session.
  if (plan.clearCart) cart.replaceCart([], null);
  if (plan.clearWishlist) wishlist.replaceWishlist([], null);

  const ids = useCartStore.getState().cart.map((line) => line.id).slice(0, MAX_IDS_PER_REQUEST);
  if (ids.length === 0) return;
  fetchProductsByIds(ids).then(
    (products) => {
      // Still a visitor's cart (no login happened meanwhile).
      if (useCartStore.getState().owner === null) useCartStore.getState().refreshLines(products, ids);
    },
    () => {}
  );
}

export function ListsSync() {
  const viewer = useViewer();
  const viewerId = viewer?.id ?? null;
  const router = useRouter();
  const cartReady = useStoreHydrated(useCartStore);
  const wishlistReady = useStoreHydrated(useWishlistStore);
  const ready = cartReady && wishlistReady;

  useEffect(
    () =>
      setListsRemote({
        addToCart: addToCartAction,
        setCartQuantity: setCartQuantityAction,
        removeFromCart: removeFromCartAction,
        clearCart: clearCartAction,
        addToWishlist: addToWishlistAction,
        removeFromWishlist: removeFromWishlistAction,
        clearWishlist: clearWishlistAction,
        onError: (message, code) => {
          showToast.error(message);
          // The session ended: re-render the layout signed out, which clears the account's copy.
          if (code === "unauthenticated") router.refresh();
        },
      }),
    [router]
  );

  useEffect(() => {
    if (!ready) return;
    let current = true;
    const isCurrent = () => current;

    if (!viewerId) {
      syncVisitor();
      return () => {
        current = false;
      };
    }

    const sync = () => void syncAccount(viewerId, isCurrent).catch(() => {});
    sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, viewerId]);

  return null;
}
