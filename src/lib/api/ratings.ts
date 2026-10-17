import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Recomputes the cached Product.rating (average of its reviews, one decimal;
 * 0 without reviews) and Product.reviewCount from the Review table, for the
 * given products or all of them. Call it in the same transaction as any
 * review write. Takes the client (or a transaction client) so the seed and
 * the tests can use it with their own connection.
 */
export async function refreshProductRatings(
  db: Pick<PrismaClient, "$executeRaw">,
  productIds?: string[]
): Promise<void> {
  if (productIds && productIds.length === 0) return;
  const ids = productIds ?? null;
  await db.$executeRaw`
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
