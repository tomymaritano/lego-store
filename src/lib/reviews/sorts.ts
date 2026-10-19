/*
 * Review list options, shared by the reviews UI, the reviews Route Handler
 * and lib/api (no server code here).
 */

export const REVIEW_SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "helpful", label: "Más útiles" },
  { value: "highest", label: "Mejor valoradas" },
  { value: "lowest", label: "Peor valoradas" },
] as const;

export type ReviewSort = (typeof REVIEW_SORTS)[number]["value"];

export const DEFAULT_REVIEW_SORT: ReviewSort = "recent";

/** Reviews per page ("Ver más reseñas" loads the next one). */
export const REVIEW_PAGE_SIZE = 5;

/** Deepest page served (and cached); past it a product would need search, not paging. */
export const MAX_REVIEW_PAGE = 50;

const SORT_VALUES = new Set<string>(REVIEW_SORTS.map((option) => option.value));

export const isReviewSort = (value: unknown): value is ReviewSort => typeof value === "string" && SORT_VALUES.has(value);

/** A sort from a query string; anything unknown is the default. */
export const parseReviewSort = (value: unknown): ReviewSort => (isReviewSort(value) ? value : DEFAULT_REVIEW_SORT);

/** A 1-based page from a query string, clamped to [1, MAX_REVIEW_PAGE]. */
export function parseReviewPage(value: unknown): number {
  const page = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isInteger(page) ? Math.min(Math.max(page, 1), MAX_REVIEW_PAGE) : 1;
}
