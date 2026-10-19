import type { PrismaClient } from "@/generated/prisma/client";
import type { MergeListsInput } from "@/lib/validations/lists";
import { getCart, mergeCartIn } from "./cart";
import type { ServerLists } from "./types";
import { getWishlist, mergeWishlistIn } from "./wishlist";

/*
 * The login merge, idempotent. The browser generates a token for each guest
 * lists it is about to merge and sends it with them (and the same token again
 * if it has to retry: the answer was lost, the tab was closed, a second sync
 * started meanwhile). The token is recorded per user in the same transaction
 * as the merge, so only the first request with it adds the guest quantities;
 * any later one (even a concurrent one, which waits on the first one's row)
 * only reads the account's lists.
 */

/** Tokens older than this are pruned; a browser retries a merge long before. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface MergeResult {
  /** False when this token had already been merged into this account (nothing was added). */
  merged: boolean;
  lists: ServerLists;
}

export function mergeLists(db: PrismaClient, userId: string, { token, cart, wishlist }: MergeListsInput): Promise<MergeResult> {
  return db.$transaction(async (tx) => {
    await tx.listMerge.deleteMany({ where: { userId, createdAt: { lt: new Date(Date.now() - TOKEN_TTL_MS) } } });
    const { count } = await tx.listMerge.createMany({ data: [{ userId, token }], skipDuplicates: true });
    if (count === 0) {
      return { merged: false, lists: { cart: await getCart(tx, userId), wishlist: await getWishlist(tx, userId) } };
    }
    return {
      merged: true,
      lists: { cart: await mergeCartIn(tx, userId, cart), wishlist: await mergeWishlistIn(tx, userId, wishlist) },
    };
  });
}
