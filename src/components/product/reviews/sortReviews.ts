import type { Review } from "@/types";

export const REVIEW_SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "helpful", label: "Más útiles" },
  { value: "highest", label: "Mejor valoradas" },
  { value: "lowest", label: "Peor valoradas" },
] as const;

export type ReviewSort = (typeof REVIEW_SORTS)[number]["value"];

const comparators: Record<ReviewSort, (a: Review, b: Review) => number> = {
  recent: (a, b) => b.date.localeCompare(a.date),
  helpful: (a, b) => b.helpful - a.helpful || b.date.localeCompare(a.date),
  highest: (a, b) => b.rating - a.rating || b.date.localeCompare(a.date),
  lowest: (a, b) => a.rating - b.rating || b.date.localeCompare(a.date),
};

/** A copy of `reviews` in the chosen order (ties: newest first). */
export function sortReviews(reviews: readonly Review[], sort: ReviewSort): Review[] {
  return [...reviews].sort(comparators[sort]);
}
