import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Recomputes the cached Product.rating (average of its reviews, one decimal;
 * 0 without reviews) and Product.reviewCount from the Review table, for the
 * given products or all of them. Call it after any review write, in the same
 * transaction when there is one. Takes the client (or a transaction client)
 * so the seed and the tests can use it with their own connection.
 *
 * Concurrency: under READ COMMITTED a single UPDATE … FROM (aggregate) would
 * aggregate over a snapshot taken before a concurrent review transaction
 * commits, and then overwrite that transaction's correct result once the row
 * lock is released. So the product rows are locked first (FOR NO KEY UPDATE,
 * which does not block review inserts' foreign-key locks, in id order to rule
 * out deadlocks), and the aggregate runs as a later statement, with a fresh
 * snapshot that includes every review committed before the lock was granted.
 * On a plain client both statements run in a transaction of their own.
 */
export async function refreshProductRatings(db: Db, productIds?: string[]): Promise<void> {
  if (productIds && productIds.length === 0) return;
  if ("$transaction" in db) {
    await db.$transaction((tx) => lockAndRefresh(tx, productIds ?? null));
  } else {
    await lockAndRefresh(db, productIds ?? null);
  }
}

async function lockAndRefresh(tx: Prisma.TransactionClient, ids: string[] | null): Promise<void> {
  await tx.$queryRaw`
    SELECT "id" FROM "Product"
    WHERE ${ids}::text[] IS NULL OR "id" = ANY(${ids}::text[])
    ORDER BY "id"
    FOR NO KEY UPDATE
  `;
  await tx.$executeRaw`
    UPDATE "Product" AS p
    SET "rating" = s.avg, "reviewCount" = s.count
    FROM (
      SELECT p2."id",
             COALESCE(ROUND(AVG(r."rating")::numeric, 1), 0)::float8 AS avg,
             COUNT(r."id")::int AS count
      FROM "Product" p2
      LEFT JOIN "Review" r ON r."productId" = p2."id"
      WHERE ${ids}::text[] IS NULL OR p2."id" = ANY(${ids}::text[])
      GROUP BY p2."id"
    ) AS s
    WHERE s."id" = p."id" AND (p."rating" <> s.avg OR p."reviewCount" <> s.count)
  `;
}
