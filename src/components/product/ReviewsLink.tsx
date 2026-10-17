"use client";

import { useReviewStore } from "@/stores/reviewStore";
import { pluralize } from "@/lib/utils";
import { REVIEWS_HASH, WRITE_REVIEW_HASH } from "./anchors";

/**
 * Where the link under the product title goes and what it says. With reviews
 * it opens the list; without any it opens the form (and says so), instead of
 * announcing "no reviews" next to the catalogue rating's stars.
 */
export function reviewsLinkTarget(count: number): { label: string; hash: string } {
  return count > 0
    ? { label: `Ver ${pluralize(count, "reseña")}`, hash: REVIEWS_HASH }
    : { label: "Escribir una reseña", hash: WRITE_REVIEW_HASH };
}

/**
 * Link under the product title to the Reseñas tab. It counts what the tab
 * lists: the published reviews (publishedCount, from the database: the same
 * reviews behind the rating next to it) plus the ones this visitor wrote in
 * this browser. ProductDetailsTabs reacts to the fragment and moves focus.
 */
export function ReviewsLink({ productId, publishedCount }: { productId: string; publishedCount: number }) {
  const ownCount = useReviewStore((state) => state.reviews.filter((r) => r.productId === productId).length);
  const count = publishedCount + ownCount;
  const { label, hash } = reviewsLinkTarget(count);
  return (
    <a
      href={`#${hash}`}
      className="rounded-sm font-semibold text-info underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {label}
    </a>
  );
}
