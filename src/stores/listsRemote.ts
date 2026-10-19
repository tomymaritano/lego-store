import type { ListActionResult, ListErrorCode } from "@/lib/lists/types";
import type { CartItem, WishlistItem } from "@/types";

/*
 * The server side of the cart and wishlist stores, for signed-in users.
 *
 * The stores stay plain local state (what a visitor has always had). When
 * their `owner` is a user id, each change is applied locally first
 * (optimistic) and then sent to the server through the remote installed here
 * by <ListsSync /> (the Server Actions in src/lib/lists/actions.ts). The
 * server answers with its version of the line, which replaces the local one;
 * if it refuses or cannot be reached, the line goes back to what it was and
 * the remote's onError tells the user (and resyncs).
 *
 * Injected rather than imported so the stores (and their unit tests) never
 * pull in server code.
 */

export interface ListsRemote {
  addToCart(productId: string, quantity: number): Promise<ListActionResult<CartItem>>;
  setCartQuantity(productId: string, quantity: number): Promise<ListActionResult<CartItem>>;
  removeFromCart(productId: string): Promise<ListActionResult<null>>;
  clearCart(): Promise<ListActionResult<null>>;
  addToWishlist(productId: string): Promise<ListActionResult<WishlistItem>>;
  removeFromWishlist(productId: string): Promise<ListActionResult<null>>;
  clearWishlist(): Promise<ListActionResult<null>>;
  /** A write failed and was rolled back locally. */
  onError(message: string, code: ListErrorCode | "network"): void;
}

let remote: ListsRemote | null = null;

/** Installs (or with null, removes) the remote. Returns a function that removes it again. */
export function setListsRemote(next: ListsRemote | null): () => void {
  remote = next;
  return () => {
    if (remote === next) remote = null;
  };
}

export const NETWORK_ERROR = "No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.";

/** Latest write per key ("cart:<id>", "wishlist:*"…): only the latest one's answer is applied. */
const versions = new Map<string, number>();

/** Writes sent so far, and those still waiting for an answer (any key). */
let writesSent = 0;
let writesInFlight = 0;

/**
 * A token for "no write since": a full reload of the lists takes one before
 * its request and checks it afterwards with noWritesSince(). If a write was
 * out at either moment, the reloaded lists may not include it, so they are not
 * adopted (the write's own answer keeps that line right; the next reload
 * brings the rest).
 */
export const writeGeneration = () => (writesInFlight > 0 ? -1 : writesSent);

export const noWritesSince = (generation: number) => generation !== -1 && writeGeneration() === generation;

interface Handlers<T> {
  /** Adopts the server's answer. */
  apply: (data: T) => void;
  /** Puts the local state back as it was before the write. */
  rollback: () => void;
}

/**
 * Sends one write to the server, if a remote is installed. Writes to the same
 * key can overlap (two quick clicks on "+"): an older answer arriving after a
 * newer write was made is ignored, so it never overwrites the newer local
 * state; the newest answer decides.
 */
export function sendWrite<T>(key: string, call: (remote: ListsRemote) => Promise<ListActionResult<T>>, { apply, rollback }: Handlers<T>): void {
  const target = remote;
  if (!target) return;
  writesSent += 1;
  const version = (versions.get(key) ?? 0) + 1;
  versions.set(key, version);
  const isLatest = () => versions.get(key) === version;

  writesInFlight += 1;
  const settled = call(target).finally(() => {
    writesInFlight -= 1;
  });
  settled.then(
    (result) => {
      if (result.ok) {
        if (isLatest()) apply(result.data);
        return;
      }
      if (isLatest()) rollback();
      target.onError(result.error, result.code);
    },
    () => {
      if (isLatest()) rollback();
      target.onError(NETWORK_ERROR, "network");
    }
  );
}
