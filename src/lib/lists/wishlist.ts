import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { WishlistItem } from "@/types";
import { listProductSelect, type Db, type ListProduct } from "./product";

/*
 * A signed-in user's wishlist in the database (WishlistItem rows), with the
 * same conventions as ./cart.ts: client first, current product data on every
 * read, ids validated against the catalogue on every write.
 */

const itemSelect = { product: { select: listProductSelect } } as const;

function toWishlistItem({ product }: { product: ListProduct }): WishlistItem {
  return { id: product.id, name: product.name, price: product.price, image: product.img, stock: product.stock };
}

/** Saved products, oldest first (sold-out ones included: the wishlist says "Agotado"). */
export async function getWishlist(db: Db, userId: string): Promise<WishlistItem[]> {
  const rows = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { productId: "asc" }],
    select: itemSelect,
  });
  return rows.map(toWishlistItem);
}

/** Saves a product (saving it twice is a no-op). Null for an unknown product. */
export async function addToWishlist(db: Db, userId: string, productId: string): Promise<WishlistItem | null> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return null;
  await db.wishlistItem.createMany({ data: [{ userId, productId }], skipDuplicates: true });
  const row = await db.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } }, select: itemSelect });
  return row ? toWishlistItem(row) : null;
}

export async function removeFromWishlist(db: Db, userId: string, productId: string): Promise<void> {
  await db.wishlistItem.deleteMany({ where: { userId, productId } });
}

export async function clearWishlist(db: Db, userId: string): Promise<void> {
  await db.wishlistItem.deleteMany({ where: { userId } });
}

/**
 * Merges a guest wishlist into the user's (on login), inside the caller's
 * transaction (./merge.ts): the union of both, skipping products that no
 * longer exist. Returns the merged wishlist.
 */
export async function mergeWishlistIn(tx: Prisma.TransactionClient, userId: string, productIds: string[]): Promise<WishlistItem[]> {
  const unique = Array.from(new Set(productIds));
  if (unique.length > 0) {
    const known = await tx.product.findMany({ where: { id: { in: unique } }, select: { id: true } });
    const ids = new Set(known.map((product) => product.id));
    // Explicit, increasing timestamps: the merged items keep the guest list's order, after the saved ones.
    const start = Date.now();
    const data = unique
      .filter((id) => ids.has(id))
      .map((productId, index) => ({ userId, productId, createdAt: new Date(start + index) }));
    await tx.wishlistItem.createMany({ data, skipDuplicates: true });
  }
  return getWishlist(tx, userId);
}

/** mergeWishlistIn in a transaction of its own. */
export function mergeWishlist(db: PrismaClient, userId: string, productIds: string[]): Promise<WishlistItem[]> {
  return db.$transaction((tx) => mergeWishlistIn(tx, userId, productIds));
}
