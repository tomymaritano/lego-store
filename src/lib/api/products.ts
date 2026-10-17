import "server-only";

import { getDb } from "@/lib/db";
import { DEFAULT_PAGE_SIZE, MAX_IDS_PER_REQUEST, MAX_PAGE_SIZE, SORT_OPTIONS } from "@/lib/productQuery";
import type { Category, Product } from "@/types";
import * as catalog from "./catalog";
import { CATALOG_TAGS, cached } from "./cache";

/*
 * Catalogue reads for pages and Route Handlers: the Prisma queries in
 * ./catalog.ts behind the Next data cache (./cache.ts). The signatures are the
 * ones the pages were written against (async, plain serialisable arguments and
 * results, null for "not found"); keep them stable.
 *
 * Only bounded reads are cached: a cache entry per product, per category and
 * per unfiltered listing. Anything a visitor can vary freely (search text,
 * price bounds, filter values, deep pages, arbitrary id lists) runs uncached,
 * so requests cannot grow the data cache without limit.
 */

const { products, categories, product } = CATALOG_TAGS;
const all = () => [products];
const categoryTags = () => [categories, products];

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));
/** Query keys an unfiltered listing may carry (the rest are filters or search). */
const BASE_QUERY_KEYS = new Set(["category", "sort", "page", "limit"]);

const isSmallLimit = (limit: number | undefined, max: number) =>
  limit === undefined || (Number.isInteger(limit) && limit >= 1 && limit <= max);

export const getProducts = cached("getProducts", () => catalog.getProducts(getDb()), all);

/** Every product id; bounds the per-product cache entries to ids that exist. */
const knownProductIds = cached("getProductIds", () => catalog.getProductIds(getDb()), all);

async function isKnownProduct(id: string): Promise<boolean> {
  return (await knownProductIds()).includes(id);
}

async function isKnownCategory(id: string): Promise<boolean> {
  return (await getCategories()).some((category) => category.id === id);
}

/** True for a listing without search or filters: the home rail and a category's first page. */
async function isUnfilteredListing(query: catalog.Query = {}): Promise<boolean> {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    if (!BASE_QUERY_KEYS.has(key)) return false;
  }
  if (query.page !== undefined && query.page !== 1) return false;
  if (query.limit !== undefined && query.limit !== DEFAULT_PAGE_SIZE) return false;
  if (query.sort !== undefined && !SORT_VALUES.has(query.sort)) return false;
  return query.category === undefined || isKnownCategory(query.category);
}

const getCachedProductById = cached(
  "getProductById",
  (id: string) => catalog.getProductById(getDb(), id),
  (id) => [products, product(id)]
);

export async function getProductById(id: string): Promise<Product | null> {
  // Unknown ids (typos, crawlers, /item/<anything>) never get a cache entry.
  if (!(await isKnownProduct(id))) return null;
  return getCachedProductById(id);
}

/**
 * Products for a list of ids, in the order given; unknown ids and duplicates
 * are skipped. Used to hydrate compare / wishlist / recently viewed, which
 * only persist ids on the client. Built from the per-product entries, so an
 * arbitrary list of ids adds no cache entry of its own.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const unique = Array.from(new Set(ids)).slice(0, MAX_IDS_PER_REQUEST);
  const found = await Promise.all(unique.map((id) => getProductById(id)));
  return found.filter((item): item is Product => item !== null);
}

/** Search (see ./search.ts), ranked by relevance. Free text: never cached. */
export async function searchProducts(query: string, options: { limit?: number } = {}): Promise<Product[]> {
  return catalog.searchProducts(getDb(), query, options);
}

/** Lightweight rows for the autocomplete. Free text: never cached. */
export async function getSearchSuggestions(query: string, limit?: number) {
  return catalog.getSearchSuggestions(getDb(), query, limit);
}

/**
 * Search + filters + sort + pagination in one call. Pages call it for the
 * first page; GET /api/products serves the next ones (infinite scroll).
 * Cached only for an unfiltered first page (see isUnfilteredListing).
 */
export const getPaginatedProducts = cached(
  "getPaginatedProducts",
  (query: catalog.Query = {}) => catalog.getPaginatedProducts(getDb(), query),
  all,
  isUnfilteredListing
);

/** Same theme or category, closest first (both > theme > category), then best rated. */
export const getRelatedProducts = cached(
  "getRelatedProducts",
  (productId: string, limit?: number) => catalog.getRelatedProducts(getDb(), productId, limit),
  all,
  async (productId, limit?) => isSmallLimit(limit, 12) && isKnownProduct(productId)
);

/**
 * Values available for each filter, with how many products have them, inside
 * an optional scope (a category page, a search). Values with 0 products in
 * scope are not listed. Cached without search text only.
 */
export const getFilterOptions = cached(
  "getFilterOptions",
  (scope: Pick<catalog.Query, "q" | "category"> = {}) => catalog.getFilterOptions(getDb(), scope),
  categoryTags,
  (scope = {}) => isUnfilteredListing(scope)
);

/**
 * Facet counts that follow the active filters (see FacetCounts): each facet
 * is counted over the products matching the search text and every other
 * filter, leaving out its own selection. Sort and paging are ignored.
 * Values missing from a map have 0 products. Cached without filters only.
 */
export const getFacetCounts = cached(
  "getFacetCounts",
  (query: catalog.Query = {}) => catalog.getFacetCounts(getDb(), query),
  all,
  isUnfilteredListing
);

/** New arrivals. */
export const getFeaturedProducts = cached(
  "getFeaturedProducts",
  (limit?: number) => catalog.getFeaturedProducts(getDb(), limit),
  all,
  (limit?) => isSmallLimit(limit, MAX_PAGE_SIZE)
);

/** Discounted products, biggest discount first. */
export const getSaleProducts = cached(
  "getSaleProducts",
  (limit?: number) => catalog.getSaleProducts(getDb(), limit),
  all,
  (limit?) => isSmallLimit(limit, MAX_PAGE_SIZE)
);

/** Categories in navigation order, with their product count. */
export const getCategories = cached("getCategories", () => catalog.getCategories(getDb()), categoryTags);

/** One category by id (case-insensitive), read from the cached category list. */
export async function getCategoryById(id: string): Promise<Category | null> {
  const wanted = id.toLowerCase();
  return (await getCategories()).find((category) => category.id.toLowerCase() === wanted) ?? null;
}
