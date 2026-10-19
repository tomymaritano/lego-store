import type { CartItem, WishlistItem } from "@/types";

/*
 * What the cart and wishlist Server Actions answer (shared with the client
 * stores, so no server code here).
 */

export type ListErrorCode = "unauthenticated" | "invalid" | "not_found" | "out_of_stock" | "rate_limited";

export type ListActionResult<T> = { ok: true; data: T } | { ok: false; code: ListErrorCode; error: string };

/** A signed-in user's lists, as the server has them (GET /api/lists, mergeListsAction). */
export interface ServerLists {
  cart: CartItem[];
  wishlist: WishlistItem[];
}

export const listErrorMessages: Record<ListErrorCode, string> = {
  unauthenticated: "Tu sesión terminó. Inicia sesión de nuevo para guardar los cambios.",
  invalid: "No pudimos guardar el cambio. Recarga la página e inténtalo de nuevo.",
  not_found: "Ese producto ya no está en el catálogo.",
  out_of_stock: "Ese producto está agotado.",
  rate_limited: "Hiciste muchos cambios seguidos. Espera unos minutos e inténtalo de nuevo.",
};
