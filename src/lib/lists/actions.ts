"use server";

import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimits, type RateLimiter } from "@/lib/rate-limit";
import { productIdSchema } from "@/lib/validations/ids";
import { mergeListsSchema, quantitySchema } from "@/lib/validations/lists";
import type { CartItem, WishlistItem } from "@/types";
import * as cart from "./cart";
import { mergeLists } from "./merge";
import * as wishlist from "./wishlist";
import { listErrorMessages, type ListActionResult, type ListErrorCode, type ServerLists } from "./types";

/*
 * Cart and wishlist Server Actions, called by the client stores when a user
 * is signed in (src/stores/listsRemote.ts). Each one checks the session
 * itself and only ever touches the signed-in user's rows: no action takes a
 * user id, and each counts against the user's rate limit (lists-write, or
 * lists-merge for the login merge). Inputs are ids and quantities, validated with zod; what comes back
 * is the server's version of the line (current price and stock, quantity
 * capped by the stock), which the store adopts.
 *
 * No cache invalidation here: carts and wishlists are per user and never
 * cached (GET /api/lists is dynamic), so the actions only return data.
 */

const fail = <T>(code: ListErrorCode): ListActionResult<T> => ({ ok: false, code, error: listErrorMessages[code] });

/** Runs `run` for the signed-in user, after counting the call against the user's limit. */
async function withUser<T>(
  run: (userId: string) => Promise<ListActionResult<T>>,
  limit: RateLimiter = rateLimits.listsWrite
): Promise<ListActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthenticated");
  if (!(await limit.consume(user.id)).ok) return fail("rate_limited");
  return run(user.id);
}

function parseId(value: unknown): string | null {
  const parsed = productIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseQuantity(value: unknown): number | null {
  const parsed = quantitySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const writeResult = (result: cart.CartWriteResult): ListActionResult<CartItem> =>
  result.ok ? { ok: true, data: result.line } : fail(result.reason);

/** Adds units of a product to the cart (summed with the line, capped by stock). */
export async function addToCartAction(productId: unknown, quantity: unknown): Promise<ListActionResult<CartItem>> {
  return withUser(async (userId) => {
    const id = parseId(productId);
    const units = parseQuantity(quantity);
    if (!id || !units) return fail("invalid");
    return writeResult(await cart.addToCart(getDb(), userId, id, units));
  });
}

/** Sets a cart line to an exact quantity (creates it if needed; capped by stock). */
export async function setCartQuantityAction(productId: unknown, quantity: unknown): Promise<ListActionResult<CartItem>> {
  return withUser(async (userId) => {
    const id = parseId(productId);
    const units = parseQuantity(quantity);
    if (!id || !units) return fail("invalid");
    return writeResult(await cart.setCartQuantity(getDb(), userId, id, units));
  });
}

export async function removeFromCartAction(productId: unknown): Promise<ListActionResult<null>> {
  return withUser(async (userId) => {
    const id = parseId(productId);
    if (!id) return fail("invalid");
    await cart.removeFromCart(getDb(), userId, id);
    return { ok: true, data: null };
  });
}

export async function clearCartAction(): Promise<ListActionResult<null>> {
  return withUser(async (userId) => {
    await cart.clearCart(getDb(), userId);
    return { ok: true, data: null };
  });
}

export async function addToWishlistAction(productId: unknown): Promise<ListActionResult<WishlistItem>> {
  return withUser(async (userId) => {
    const id = parseId(productId);
    if (!id) return fail("invalid");
    const item = await wishlist.addToWishlist(getDb(), userId, id);
    return item ? { ok: true, data: item } : fail("not_found");
  });
}

export async function removeFromWishlistAction(productId: unknown): Promise<ListActionResult<null>> {
  return withUser(async (userId) => {
    const id = parseId(productId);
    if (!id) return fail("invalid");
    await wishlist.removeFromWishlist(getDb(), userId, id);
    return { ok: true, data: null };
  });
}

export async function clearWishlistAction(): Promise<ListActionResult<null>> {
  return withUser(async (userId) => {
    await wishlist.clearWishlist(getDb(), userId);
    return { ok: true, data: null };
  });
}

/**
 * On login: adds this browser's guest cart and wishlist to the account
 * (quantities summed and capped by stock, wishlists united) and returns the
 * result, which becomes the browser's copy. Idempotent per token
 * (./merge.ts): a retried or repeated merge adds nothing twice.
 */
export async function mergeListsAction(input: unknown): Promise<ListActionResult<ServerLists>> {
  return withUser(async (userId) => {
    const parsed = mergeListsSchema.safeParse(input);
    if (!parsed.success) return fail("invalid");
    const { lists } = await mergeLists(getDb(), userId, parsed.data);
    return { ok: true, data: lists };
  }, rateLimits.listsMerge);
}
