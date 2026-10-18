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
import { newMergeToken, readPendingMerge, writePendingMerge } from "@/lib/lists/pending-merge";
import { planCartReplay, planListsSync, planWishlistReplay } from "@/lib/lists/sync-plan";
import type { ServerLists } from "@/lib/lists/types";
import { fetchProductsByIds } from "@/lib/api-client";
import { MAX_IDS_PER_REQUEST } from "@/lib/productQuery";
import { useViewer } from "@/providers/ViewerProvider";
import { useCartStore, useStoreHydrated, useWishlistStore } from "@/stores";
import { noWritesSince, setListsRemote, writeGeneration } from "@/stores/listsRemote";
import { showToast } from "@/components/ui";
import type { CartLineInput } from "@/lib/validations/lists";
import type { CartItem, WishlistItem } from "@/types";

/*
 * Keeps the browser's cart and wishlist in step with the account (see
 * src/lib/lists/sync-plan.ts for the rules):
 * - installs the server remote the stores send a signed-in user's changes to;
 * - once the stores have loaded localStorage, and again whenever the session
 *   changes: merges a visitor's lists into the account on login, reloads the
 *   account's lists (server truth: current prices and stock), clears the
 *   account's copy on logout. Account syncs run one at a time (a second one
 *   waits for the first), and a merge is idempotent: the payload and its
 *   token are kept until the answer is adopted, so a retry never adds the
 *   guest lines twice (src/lib/lists/pending-merge.ts, merge.ts); changes
 *   made while it was out are replayed on top of the merged lists;
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

/** Re-applies, as writes to the account, what the user changed in the guest lists since `sent` was merged. */
function replayChanges(sent: { cart: CartLineInput[] | null; wishlist: string[] | null }, now: { cart: CartItem[]; wishlist: WishlistItem[] }) {
  const cart = useCartStore.getState();
  for (const change of sent.cart ? planCartReplay(sent.cart, now.cart) : []) {
    const merged = useCartStore.getState().cart.find((line) => line.id === (change.kind === "add" ? change.line.id : change.id));
    if (change.kind === "remove") cart.removeItem(change.id);
    else if (change.kind === "add" && !merged) cart.restoreItem(change.line);
    else if (merged) cart.setQuantity(merged.id, merged.quantity + (change.kind === "add" ? change.line.quantity : change.delta));
  }
  const wishlist = useWishlistStore.getState();
  for (const change of sent.wishlist ? planWishlistReplay(sent.wishlist, now.wishlist) : []) {
    if (change.kind === "add") wishlist.restoreItem(change.item);
    else wishlist.removeFromWishlist(change.id);
  }
}

async function syncAccount(viewerId: string, isCurrent: () => boolean) {
  const cart = useCartStore.getState();
  const wishlist = useWishlistStore.getState();
  const plan = planListsSync(viewerId, { cart: cart.owner, wishlist: wishlist.owner });
  if (plan.kind !== "account") return;

  if (plan.mergeCart || plan.mergeWishlist) {
    // A merge sent before and never seen answered is resent as it was (same token): the
    // server added it at most once. Otherwise the guest lists as they are now.
    const pending = readPendingMerge();
    const payload = {
      token: pending?.token ?? newMergeToken(),
      cart: plan.mergeCart ? (pending?.cart ?? cart.cart.map((line) => ({ productId: line.id, quantity: line.quantity }))) : [],
      wishlist: plan.mergeWishlist ? (pending?.wishlist ?? wishlist.wishlist.map((item) => item.id)) : [],
    };
    writePendingMerge(payload);
    const result = await mergeListsAction(payload);
    // Not adopted (signed out meanwhile, or the merge failed): the payload stays pending, and the
    // next sync for an account resends it with its token.
    if (!isCurrent() || !result.ok) return;
    // The guest lists as they are now: changes made while the merge was out were local only.
    const now = { cart: useCartStore.getState().cart, wishlist: useWishlistStore.getState().wishlist };
    adopt(result.data, viewerId);
    writePendingMerge(null);
    replayChanges({ cart: plan.mergeCart ? payload.cart : null, wishlist: plan.mergeWishlist ? payload.wishlist : null }, now);
    if (payload.cart.length + payload.wishlist.length > 0) {
      showToast.info("Guardamos en tu cuenta lo que tenías en el carrito y en favoritos.");
    }
    return;
  }

  const generation = writeGeneration();
  const lists = await fetchServerLists();
  // A change made while the request was out is newer than this answer: keep the local copy.
  if (isCurrent() && noWritesSince(generation)) adopt(lists, viewerId);
}

/*
 * Account syncs run one at a time: a sync asked for while another is out
 * (the tab came back into view during the login merge) waits for it, and then
 * finds the lists already owned by the account, so it reloads instead of
 * merging again. Requests made while one is waiting collapse into it; it runs
 * for the latest viewer.
 */
let syncChain: Promise<void> = Promise.resolve();
let syncWaiting = false;
let latestSync: { viewerId: string; isCurrent: () => boolean } | null = null;

function requestAccountSync(viewerId: string, isCurrent: () => boolean) {
  latestSync = { viewerId, isCurrent };
  if (syncWaiting) return;
  syncWaiting = true;
  syncChain = syncChain
    .then(() => {
      syncWaiting = false;
      const target = latestSync;
      if (!target?.isCurrent()) return;
      return syncAccount(target.viewerId, target.isCurrent);
    })
    .catch(() => {});
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

    const sync = () => requestAccountSync(viewerId, isCurrent);
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
