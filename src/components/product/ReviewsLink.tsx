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
 * Link under the product title to the Reseñas tab. Its count comes from the
 * same source as the tab (reviewStore), so it never promises reviews the tab
 * does not have; the stars next to it are the catalogue rating, labelled as
 * such by the page. ProductDetailsTabs reacts to the fragment and moves focus.
 */
export function ReviewsLink({ productId }: { productId: string }) {
  const count = useReviewStore((state) => state.reviews.filter((r) => r.productId === productId).length);
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
