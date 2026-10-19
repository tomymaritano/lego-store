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
 * lists: the product's reviews in the database (the same ones behind the
 * rating next to it; a review write re-renders the page with the new count).
 * ProductDetailsTabs reacts to the fragment and moves focus.
 */
export function ReviewsLink({ count }: { count: number }) {
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
