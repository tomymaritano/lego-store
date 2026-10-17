import type { PrismaClient } from "@/generated/prisma/client";
import type { Review } from "@/types";

/*
 * Review reads on Prisma, uncached (./products.ts exposes them behind the data
 * cache). Takes the client first, like ./catalog.ts.
 */

/** Order states in which the buyer has paid: their review is a "compra verificada". */
const PAID_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

/**
 * A product's reviews, newest first, in the shape the reviews UI renders:
 * author display name, "útil" votes counted from ReviewHelpful, verified when
 * the author has a paid order with this product, date as YYYY-MM-DD (UTC).
 */
export async function getProductReviews(db: PrismaClient, productId: string): Promise<Review[]> {
  const rows = await db.review.findMany({
    where: { productId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      rating: true,
      title: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true } },
      _count: { select: { helpfulVotes: true } },
    },
  });
  if (rows.length === 0) return [];

  const buyers = await db.order.findMany({
    where: {
      userId: { in: rows.map((row) => row.userId) },
      status: { in: [...PAID_STATUSES] },
      items: { some: { productId } },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const verified = new Set(buyers.map((order) => order.userId));

  return rows.map((row) => ({
    id: row.id,
    productId,
    userId: row.userId,
    userName: row.user.name?.trim() || "Cliente",
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    date: row.createdAt.toISOString().slice(0, 10),
    helpful: row._count.helpfulVotes,
    verified: verified.has(row.userId),
  }));
}
