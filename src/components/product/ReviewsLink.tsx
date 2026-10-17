"use client";

import { useReviewStore } from "@/stores/reviewStore";
import { pluralize } from "@/lib/utils";
import { REVIEWS_HASH } from "./anchors";

/** The visible label of the link to the reviews tab: how many reviews it will show. */
export function reviewsLinkLabel(count: number): string {
  return count > 0 ? `Ver ${pluralize(count, "reseña")}` : "Aún sin reseñas · Escribe la primera";
}

/**
 * Link under the product title that opens the Reseñas tab. Its count comes
 * from the same source as the tab (reviewStore), so it never promises reviews
 * the tab does not have; the stars next to it are the catalogue rating,
 * labelled as such by the page.
 */
export function ReviewsLink({ productId }: { productId: string }) {
  const count = useReviewStore((state) => state.reviews.filter((r) => r.productId === productId).length);
  return (
    <a
      href={`#${REVIEWS_HASH}`}
      className="rounded-sm font-semibold text-info underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {reviewsLinkLabel(count)}
    </a>
  );
}
