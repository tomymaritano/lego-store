import type { MergeListsInput } from "@/lib/validations/lists";

/*
 * The login merge a browser has sent but not seen answered yet (client only).
 * Kept in localStorage until the merged lists are adopted, so a retry (the
 * next sync, the next page load) resends the very same guest lists with the
 * same token, and the server adds them at most once (src/lib/lists/merge.ts).
 * Falls back to memory when storage is unavailable.
 *
 * No zod here: this module ships in the root layout's client bundle, and zod
 * would add ~30 kB gzip to every page. The shape check below only screens out
 * a corrupt or foreign localStorage value; the merge Server Action validates
 * the payload for real with mergeListsSchema.
 */

const KEY = "lego-lists-merge";
/** Mirrors MAX_LIST_ITEMS / MAX_LINE_QUANTITY in src/lib/validations/lists.ts (type-only import keeps zod out). */
const MAX_ITEMS = 200;
const MAX_QUANTITY = 999;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

let inMemory: MergeListsInput | null = null;

function isProductId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 64;
}

/** Whether a parsed localStorage value looks like a pending merge. */
export function isPendingMerge(value: unknown): value is MergeListsInput {
  if (typeof value !== "object" || value === null) return false;
  const { token, cart, wishlist } = value as Record<string, unknown>;
  if (typeof token !== "string" || !TOKEN.test(token)) return false;
  if (!Array.isArray(cart) || cart.length > MAX_ITEMS) return false;
  if (!Array.isArray(wishlist) || wishlist.length > MAX_ITEMS) return false;
  const cartOk = cart.every((line: unknown) => {
    if (typeof line !== "object" || line === null) return false;
    const { productId, quantity } = line as Record<string, unknown>;
    return (
      isProductId(productId) &&
      typeof quantity === "number" &&
      Number.isInteger(quantity) &&
      quantity >= 1 &&
      quantity <= MAX_QUANTITY
    );
  });
  return cartOk && wishlist.every(isProductId);
}

export function readPendingMerge(): MergeListsInput | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingMerge(parsed) ? parsed : null;
  } catch {
    return inMemory;
  }
}

export function writePendingMerge(merge: MergeListsInput | null): void {
  inMemory = merge;
  try {
    if (merge) window.localStorage.setItem(KEY, JSON.stringify(merge));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Memory only: a reload before the answer would merge again with a new token.
  }
}

/** A random token for a new merge (randomUUID needs a secure context; plain random bytes otherwise). */
export function newMergeToken(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
