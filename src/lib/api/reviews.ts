import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { STORE_TIME_ZONE } from "@/lib/argentina";
import type { ReviewSort } from "@/lib/reviews/sorts";
import type { Review, ReviewPage, ReviewSummary, ViewerReviews } from "@/types";

/*
 * Review reads on Prisma, uncached (./products.ts exposes the public ones
 * behind the data cache). Takes the client first, like ./catalog.ts.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Order states in which the buyer has paid: their review is a "compra verificada". */
export const PAID_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

const reviewSelect = {
  id: true,
  userId: true,
  productId: true,
  rating: true,
  title: true,
  comment: true,
  createdAt: true,
  user: { select: { name: true } },
  _count: { select: { helpfulVotes: true } },
} as const;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

const ORDER_BY: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }, { id: "asc" }],
  helpful: [{ helpfulVotes: { _count: "desc" } }, { createdAt: "desc" }, { id: "asc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }, { id: "asc" }],
};

/**
 * Which of `userIds` bought `productId` and paid for it (an order of their
 * account in PAID, SHIPPED or DELIVERED containing it). Guest orders never
 * count: they are not linked to accounts.
 */
async function verifiedBuyers(db: Db, productId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const buyers = await db.order.findMany({
    where: { userId: { in: userIds }, status: { in: [...PAID_STATUSES] }, items: { some: { productId } } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return new Set(buyers.flatMap((order) => (order.userId ? [order.userId] : [])));
}

/** YYYY-MM-DD in the store's time zone (en-CA formats dates that way). */
const storeDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Rows in the shape the reviews UI renders: author display name, "útil" votes
 * counted from ReviewHelpful, verified when the author paid for the product,
 * date as YYYY-MM-DD in Argentina (a review posted at 22:00 there is still
 * that day's). The author's account id stays here: these lists are public.
 */
async function toReviews(db: Db, productId: string, rows: ReviewRow[]): Promise<Review[]> {
  const verified = await verifiedBuyers(
    db,
    productId,
    Array.from(new Set(rows.map((row) => row.userId)))
  );
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    userName: row.user.name?.trim() || "Cliente",
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    date: storeDate.format(row.createdAt),
    helpful: row._count.helpfulVotes,
    verified: verified.has(row.userId),
  }));
}

/** Average (one decimal) and the 5-to-1 histogram of a product's reviews. */
export async function getReviewSummary(db: Db, productId: string): Promise<ReviewSummary> {
  const groups = await db.review.groupBy({ by: ["rating"], where: { productId }, _count: { _all: true } });
  const byRating = new Map(groups.map((group) => [group.rating, group._count._all]));
  const count = groups.reduce((sum, group) => sum + group._count._all, 0);
  const total = groups.reduce((sum, group) => sum + group.rating * group._count._all, 0);
  return {
    average: count === 0 ? 0 : Math.round((total / count) * 10) / 10,
    count,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: byRating.get(rating) ?? 0 })),
  };
}

export interface ReviewPageQuery {
  sort: ReviewSort;
  /** 1-based. */
  page: number;
  limit: number;
}

/** One page of a product's reviews in the given order, with the summary over all of them. */
export async function getReviewPage(db: Db, productId: string, { sort, page, limit }: ReviewPageQuery): Promise<ReviewPage> {
  const [summary, rows] = await Promise.all([
    getReviewSummary(db, productId),
    db.review.findMany({
      where: { productId },
      orderBy: ORDER_BY[sort],
      skip: (page - 1) * limit,
      take: limit,
      select: reviewSelect,
    }),
  ]);
  const totalPages = Math.ceil(summary.count / limit);
  return {
    items: await toReviews(db, productId, rows),
    summary,
    sort,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** A signed-in user's own review of a product (if any) and the reviews of it they marked "útil". */
export async function getViewerReviews(db: Db, userId: string, productId: string): Promise<ViewerReviews> {
  const [own, votes] = await Promise.all([
    db.review.findUnique({ where: { userId_productId: { userId, productId } }, select: reviewSelect }),
    db.reviewHelpful.findMany({ where: { userId, review: { productId } }, select: { reviewId: true } }),
  ]);
  return {
    review: own ? (await toReviews(db, productId, [own]))[0]! : null,
    helpful: votes.map((vote) => vote.reviewId),
  };
}
