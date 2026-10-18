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
