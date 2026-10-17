import "server-only";

import { getDb } from "@/lib/db";
import * as catalog from "./catalog";
import { CATALOG_TAGS, cached } from "./cache";

/*
 * Catalogue reads for pages and Route Handlers: the Prisma queries in
 * ./catalog.ts behind the Next data cache (./cache.ts). The signatures are the
 * ones the pages were written against (async, plain serialisable arguments and
 * results, null for "not found"); keep them stable.
 */

const { products, categories, product } = CATALOG_TAGS;
const all = () => [products];

export const getProducts = cached("getProducts", () => catalog.getProducts(getDb()), all);

export const getProductById = cached(
  "getProductById",
  (id: string) => catalog.getProductById(getDb(), id),
  (id) => [products, product(id)]
);

/**
 * Products for a list of ids, in the order given; unknown ids and duplicates
 * are skipped. Used to hydrate compare / wishlist / recently viewed, which
 * only persist ids on the client.
 */
export const getProductsByIds = cached(
  "getProductsByIds",
  (ids: string[]) => catalog.getProductsByIds(getDb(), ids),
  all
);

/** Search (see ./search.ts), ranked by relevance. */
export const searchProducts = cached(
  "searchProducts",
  (query: string, options: { limit?: number } = {}) => catalog.searchProducts(getDb(), query, options),
  all
);

/** Lightweight rows for the autocomplete. */
export const getSearchSuggestions = cached(
  "getSearchSuggestions",
  (query: string, limit?: number) => catalog.getSearchSuggestions(getDb(), query, limit),
  all
);

/**
 * Search + filters + sort + pagination in one call. Pages call it for the
 * first page; GET /api/products serves the next ones (infinite scroll).
 */
export const getPaginatedProducts = cached(
  "getPaginatedProducts",
  (query: catalog.Query = {}) => catalog.getPaginatedProducts(getDb(), query),
  all
);

/** Same theme or category, closest first (both > theme > category), then best rated. */
export const getRelatedProducts = cached(
  "getRelatedProducts",
  (productId: string, limit?: number) => catalog.getRelatedProducts(getDb(), productId, limit),
  all
);

/**
 * Values available for each filter, with how many products have them, inside
 * an optional scope (a category page, a search). Values with 0 products in
 * scope are not listed.
 */
export const getFilterOptions = cached(
  "getFilterOptions",
  (scope: Pick<catalog.Query, "q" | "category"> = {}) => catalog.getFilterOptions(getDb(), scope),
  () => [products, categories]
);

/**
 * Facet counts that follow the active filters (see FacetCounts): each facet
 * is counted over the products matching the search text and every other
 * filter, leaving out its own selection. Sort and paging are ignored.
 * Values missing from a map have 0 products.
 */
export const getFacetCounts = cached(
  "getFacetCounts",
  (query: catalog.Query = {}) => catalog.getFacetCounts(getDb(), query),
  all
);

/** New arrivals. */
export const getFeaturedProducts = cached(
  "getFeaturedProducts",
  (limit?: number) => catalog.getFeaturedProducts(getDb(), limit),
  all
);

/** Discounted products, biggest discount first. */
export const getSaleProducts = cached(
  "getSaleProducts",
  (limit?: number) => catalog.getSaleProducts(getDb(), limit),
  all
);

/** Categories in navigation order, with their product count. */
export const getCategories = cached("getCategories", () => catalog.getCategories(getDb()), () => [categories, products]);

export const getCategoryById = cached(
  "getCategoryById",
  (id: string) => catalog.getCategoryById(getDb(), id),
  () => [categories, products]
);
