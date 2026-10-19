import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { recordAudit, type AuditActor } from "@/lib/admin/audit";
import { refreshProductRatings } from "@/lib/api/ratings";
import type { ReviewInput } from "@/lib/validations/review";

/*
 * Review writes, client first (the Server Actions in ./actions.ts pass the
 * app's client, the integration tests their own). Each write runs in one
 * transaction with refreshProductRatings, so Product.rating and reviewCount
 * never disagree with the Review table; the caller then refreshes the cached
 * catalogue (updateCatalog / invalidateCatalog) for `productId`.
 *
 * Ownership is part of every query (`where: { id, userId }`): someone else's
 * review reads as not found, so a request cannot even learn it exists.
 */

export type ReviewWriteResult =
  /** `ratingChanged`: the product's rating or review count may have moved (false for a text-only edit). */
  | { ok: true; productId: string; reviewId: string; ratingChanged: boolean }
  | { ok: false; reason: "not_found" | "duplicate" };

export type HelpfulResult =
  | { ok: true; productId: string; voted: boolean; helpful: number }
  | { ok: false; reason: "not_found" | "own_review" };

/**
 * Who deletes a review: its author (only their own, whatever their role), or
 * an admin moderating (any review, always with its audit entry).
 */
export type ReviewDeleter = { author: string } | { moderator: AuditActor };

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** One review per user and product (database unique key): a second one is "duplicate". */
export async function createReview(db: PrismaClient, userId: string, productId: string, input: ReviewInput): Promise<ReviewWriteResult> {
  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, archivedAt: null }, select: { id: true } });
      if (!product) return { ok: false, reason: "not_found" } as const;
      const existing = await tx.review.findUnique({ where: { userId_productId: { userId, productId } }, select: { id: true } });
      if (existing) return { ok: false, reason: "duplicate" } as const;
      const review = await tx.review.create({
        data: { userId, productId, rating: input.rating, title: input.title, comment: input.comment },
        select: { id: true },
      });
      await refreshProductRatings(tx, [productId]);
      return { ok: true, productId, reviewId: review.id, ratingChanged: true } as const;
    });
  } catch (error) {
    // Two submissions racing past the check: the unique key keeps one.
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

/** Edits the user's own review (rating, title, comment). */
export function updateReview(db: PrismaClient, userId: string, reviewId: string, input: ReviewInput): Promise<ReviewWriteResult> {
  return db.$transaction(async (tx) => {
    const review = await tx.review.findFirst({ where: { id: reviewId, userId }, select: { productId: true, rating: true } });
    if (!review) return { ok: false, reason: "not_found" } as const;
    await tx.review.update({
      where: { id: reviewId },
      data: { rating: input.rating, title: input.title, comment: input.comment },
    });
    const ratingChanged = review.rating !== input.rating;
    if (ratingChanged) await refreshProductRatings(tx, [review.productId]);
    return { ok: true, productId: review.productId, reviewId, ratingChanged } as const;
  });
}

/**
 * Deletes a review: the author's own, or any as moderation. A moderation
 * deletion always writes its audit entry (the review's content goes to the
 * audit log, since the review itself is gone): there is no way to delete
 * someone else's review without one.
 */
export function deleteReview(db: PrismaClient, deleter: ReviewDeleter, reviewId: string): Promise<ReviewWriteResult> {
  return db.$transaction(async (tx) => {
    const where = "moderator" in deleter ? { id: reviewId } : { id: reviewId, userId: deleter.author };
    const review = await tx.review.findFirst({
      where,
      select: { productId: true, rating: true, title: true, comment: true, user: { select: { email: true } } },
    });
    if (!review) return { ok: false, reason: "not_found" } as const;
    await tx.review.delete({ where: { id: reviewId } });
    await refreshProductRatings(tx, [review.productId]);
    if ("moderator" in deleter) {
      await recordAudit(tx, deleter.moderator, {
        action: "review.delete",
        entityType: "review",
        entityId: reviewId,
        changes: { productId: review.productId, author: review.user.email, rating: review.rating, title: review.title, comment: review.comment },
      });
    }
    return { ok: true, productId: review.productId, reviewId, ratingChanged: true } as const;
  });
}

/**
 * Marks (`helpful` true) or unmarks a review as "útil" for the user. Each user
 * counts once (primary key on user + review), and setting the same value twice
 * changes nothing, so a double click or two tabs cannot count twice. Authors
 * cannot vote for their own review.
 */
export async function setHelpful(db: PrismaClient, userId: string, reviewId: string, helpful: boolean): Promise<HelpfulResult> {
  const review = await db.review.findUnique({ where: { id: reviewId }, select: { userId: true, productId: true } });
  if (!review) return { ok: false, reason: "not_found" };
  if (review.userId === userId) return { ok: false, reason: "own_review" };
  if (helpful) {
    try {
      await db.reviewHelpful.createMany({ data: [{ userId, reviewId }], skipDuplicates: true });
    } catch (error) {
      // The review was deleted in the meantime (foreign key).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return { ok: false, reason: "not_found" };
      throw error;
    }
  } else {
    await db.reviewHelpful.deleteMany({ where: { userId, reviewId } });
  }
  const count = await db.reviewHelpful.count({ where: { reviewId } });
  return { ok: true, productId: review.productId, voted: helpful, helpful: count };
}
