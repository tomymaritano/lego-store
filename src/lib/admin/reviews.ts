import type { Prisma } from "@/generated/prisma/client";
import { escapeLike, normalizeText } from "@/lib/api/search";
import type { Db } from "@/lib/lists/product";
import { ADMIN_PAGE_SIZE, type AdminReviewFilters } from "@/lib/validations/admin";
import { pageCount, type Page } from "./format";

/*
 * Review moderation: every review, newest first, filtered by product, stars
 * or text. Deleting one goes through deleteReview (src/lib/reviews/mutations.ts)
 * with the admin as actor, which recomputes the product's rating in the same
 * transaction. No permission checks here (./data.ts and ./actions.ts).
 */

export interface AdminReviewRow {
  id: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  helpful: number;
  product: { id: string; name: string; archived: boolean };
  author: { name: string | null; email: string };
}

function reviewWhere(filters: AdminReviewFilters): Prisma.ReviewWhereInput {
  const and: Prisma.ReviewWhereInput[] = [];
  if (filters.product) and.push({ productId: filters.product });
  if (filters.rating !== null) and.push({ rating: filters.rating });
  const q = filters.q.trim();
  if (q) {
    const contains = { contains: escapeLike(q), mode: "insensitive" } as const;
    and.push({
      OR: [
        { title: contains },
        { comment: contains },
        { user: { email: { contains: escapeLike(q.toLowerCase()) } } },
        { user: { name: contains } },
        { product: { searchName: { contains: escapeLike(normalizeText(q)) } } },
      ],
    });
  }
  return { AND: and };
}

export async function listAdminReviews(db: Db, filters: AdminReviewFilters): Promise<Page<AdminReviewRow>> {
  const where = reviewWhere(filters);
  const total = await db.review.count({ where });
  const totalPages = pageCount(total);
  const page = Math.min(filters.page, totalPages);
  const rows = await db.review.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      createdAt: true,
      _count: { select: { helpfulVotes: true } },
      product: { select: { id: true, name: true, archivedAt: true } },
      user: { select: { name: true, email: true } },
    },
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      helpful: row._count.helpfulVotes,
      product: { id: row.product.id, name: row.product.name, archived: row.product.archivedAt !== null },
      author: { name: row.user.name, email: row.user.email },
    })),
    total,
    page,
    totalPages,
  };
}

/** Products that have reviews, for the filter (id and name). */
export async function reviewedProducts(db: Db) {
  return db.product.findMany({
    where: { reviews: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
