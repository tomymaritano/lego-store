import type { CartLineInput } from "@/lib/validations/lists";
import type { CartItem, WishlistItem } from "@/types";

/*
 * What <ListsSync /> does with the browser's cart and wishlist when the page
 * loads or the session changes. Pure, so it is unit tested on its own.
 *
 * Each store records its `owner`: null for a visitor's own list, a user id
 * for a copy of that account's server list.
 *
 * - Signed out: a copy of an account's list is cleared (logout, or the session
 *   ended); a visitor's own list stays.
 * - Signed in: a visitor's list is merged into the account (once: afterwards
 *   the store is the account's copy); the account's own copy is reloaded from
 *   the server (the truth); another account's copy is discarded, never merged.
 */

export type ListsSyncPlan =
  | { kind: "visitor"; clearCart: boolean; clearWishlist: boolean }
  | { kind: "account"; mergeCart: boolean; mergeWishlist: boolean };

export function planListsSync(viewerId: string | null, owners: { cart: string | null; wishlist: string | null }): ListsSyncPlan {
  if (!viewerId) return { kind: "visitor", clearCart: owners.cart !== null, clearWishlist: owners.wishlist !== null };
  return { kind: "account", mergeCart: owners.cart === null, mergeWishlist: owners.wishlist === null };
}

/*
 * Changes made to a visitor's lists while their merge into the account was
 * out (or since an earlier attempt whose answer never came): the browser's
 * lists, compared with what the merge sent. Applied on top of the merged
 * lists once they are adopted, as ordinary writes to the account, so nothing
 * the user did meanwhile is lost and nothing is merged twice.
 */

export type CartReplay =
  /** A line added meanwhile: its units are added to the account's line (or it becomes one). */
  | { kind: "add"; line: CartItem }
  /** A line whose quantity changed meanwhile: the account's line moves by the same amount. */
  | { kind: "change"; id: string; delta: number }
  /** A line removed meanwhile. */
  | { kind: "remove"; id: string };

export type WishlistReplay = { kind: "add"; item: WishlistItem } | { kind: "remove"; id: string };

export function planCartReplay(sent: CartLineInput[], now: CartItem[]): CartReplay[] {
  const sentQuantity = new Map(sent.map((line) => [line.productId, line.quantity]));
  const changes: CartReplay[] = [];
  for (const line of now) {
    const before = sentQuantity.get(line.id);
    if (before === undefined) changes.push({ kind: "add", line });
    else if (before !== line.quantity) changes.push({ kind: "change", id: line.id, delta: line.quantity - before });
  }
  const kept = new Set(now.map((line) => line.id));
  for (const { productId } of sent) if (!kept.has(productId)) changes.push({ kind: "remove", id: productId });
  return changes;
}

export function planWishlistReplay(sent: string[], now: WishlistItem[]): WishlistReplay[] {
  const sentIds = new Set(sent);
  const kept = new Set(now.map((item) => item.id));
  return [
    ...now.filter((item) => !sentIds.has(item.id)).map((item): WishlistReplay => ({ kind: "add", item })),
    ...sent.filter((id) => !kept.has(id)).map((id): WishlistReplay => ({ kind: "remove", id })),
  ];
}
