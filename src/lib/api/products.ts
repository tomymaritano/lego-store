import "server-only";

import { products as catalogue } from "@/data/products";
import { categories as categoryData } from "@/data/categories";
import { DEFAULT_PAGE_SIZE, MAX_IDS_PER_REQUEST, MAX_PAGE_SIZE } from "@/lib/productQuery";
import type {
  Category,
  FilterOption,
  FilterOptions,
  PaginatedResponse,
  Product,
  ProductFilters,
  ProductQuery,
  SearchSuggestion,
  SortOption,
} from "@/types";
import { normalizeText, search } from "./search";

/*
 * Catalogue reads. Today they run over the mock data in src/data; the backend
 * will swap the bodies for database queries, so keep the signatures as they
 * are: async, plain serialisable arguments and results, null for "not found".
 */


const categoryName = (slug: string) => categoryData.find((c) => c.id === slug)?.name;

const same = (a: string, b: string) => normalizeText(a) === normalizeText(b);
const oneOf = (value: string, list: string[]) => list.some((item) => same(item, value));

/** Applies every filter in `filters` (AND across fields, OR inside a list). */
function applyFilters(list: Product[], filters: ProductFilters): Product[] {
  const { category, themes, types, ages, interests, pieces, highlights } = filters;
  const { minPrice, maxPrice, minRating, inStock, onSale, isNew } = filters;

  return list.filter(
    (p) =>
      (!category || same(p.category, category)) &&
      (!themes?.length || oneOf(p.theme, themes)) &&
      (!types?.length || oneOf(p.type, types)) &&
      (!ages?.length || oneOf(p.age, ages)) &&
      (!interests?.length || p.interests.some((i) => oneOf(i, interests))) &&
      (!pieces?.length || oneOf(p.pieces, pieces)) &&
      (!highlights?.length || oneOf(p.highlight, highlights)) &&
      (minPrice === undefined || p.price >= minPrice) &&
      (maxPrice === undefined || p.price <= maxPrice) &&
      (minRating === undefined || p.rating >= minRating) &&
      (!inStock || p.stock > 0) &&
      (!onSale || p.isOnSale) &&
      (!isNew || p.isNew)
  );
}

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });

/** Returns a sorted copy. "featured" keeps the incoming order (catalogue or search relevance). */
function sortProducts(list: Product[], sort: SortOption = "featured"): Product[] {
  const sorted = [...list];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => Number(b.isNew) - Number(a.isNew) || Number(b.id) - Number(a.id));
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "name-asc":
      return sorted.sort(byName);
    case "name-desc":
      return sorted.sort((a, b) => byName(b, a));
    case "featured":
    default:
      return sorted;
  }
}

/** The products in scope for a query: search first (it ranks), then filters. */
function scope(query: Pick<ProductQuery, "q"> & ProductFilters): Product[] {
  const base = query.q?.trim() ? search(catalogue, query.q, categoryName) : catalogue;
  return applyFilters(base, query);
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

// ---------------------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  return [...catalogue];
}

export async function getProductById(id: string): Promise<Product | null> {
  return catalogue.find((p) => p.id === id) ?? null;
}

/**
 * Products for a list of ids, in the order given; unknown ids and duplicates
 * are skipped. Used to hydrate compare / wishlist / recently viewed, which
 * only persist ids on the client.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const unique = Array.from(new Set(ids)).slice(0, MAX_IDS_PER_REQUEST);
  return unique.map((id) => catalogue.find((p) => p.id === id)).filter((p): p is Product => !!p);
}

/** Full-text search (see ./search.ts), ranked by relevance. */
export async function searchProducts(query: string, options: { limit?: number } = {}): Promise<Product[]> {
  const results = search(catalogue, query, categoryName);
  return options.limit === undefined ? results : results.slice(0, Math.max(0, options.limit));
}

/** Lightweight rows for the autocomplete. */
export async function getSearchSuggestions(
  query: string,
  limit = 5
): Promise<{ items: SearchSuggestion[]; total: number }> {
  const results = search(catalogue, query, categoryName);
  return {
    items: results.slice(0, limit).map(({ id, name, price, img, theme }) => ({ id, name, price, img, theme })),
    total: results.length,
  };
}

/**
 * Search + filters + sort + pagination in one call. Pages call it for the
 * first page; GET /api/products serves the next ones (infinite scroll).
 */
export async function getPaginatedProducts(query: ProductQuery = {}): Promise<PaginatedResponse<Product>> {
  const limit = clampInt(query.limit, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1);

  const sorted = sortProducts(scope(query), query.sort);
  const total = sorted.length;
  const start = (page - 1) * limit;

  return {
    items: sorted.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasMore: start + limit < total,
  };
}

/** Same theme or category, closest first (both > theme > category), then best rated. */
export async function getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
  const product = catalogue.find((p) => p.id === productId);
  if (!product) return [];

  return catalogue
    .filter((p) => p.id !== productId)
    .map((p) => ({
      p,
      score: (p.theme === product.theme ? 2 : 0) + (p.category === product.category ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.p.rating - a.p.rating)
    .slice(0, limit)
    .map(({ p }) => p);
}

/** Leading number of "12+", "501-1000", "2001+" for natural ordering. */
const leadingNumber = (value: string) => Number.parseInt(value, 10) || 0;

function facet(
  list: Product[],
  values: (p: Product) => string[],
  order: "alpha" | "numeric" = "alpha",
  label: (value: string) => string = (v) => v
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const p of list) {
    for (const value of new Set(values(p))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, label: label(value), count })).sort((a, b) =>
    order === "numeric" ? leadingNumber(a.value) - leadingNumber(b.value) : a.label.localeCompare(b.label, "es")
  );
}

/**
 * Values available for each filter, with how many products have them, inside
 * an optional scope (a category page, a search). Values with 0 products in
 * scope are not listed.
 */
export async function getFilterOptions(
  scopeQuery: Pick<ProductQuery, "q" | "category"> = {}
): Promise<FilterOptions> {
  const list = scope({ q: scopeQuery.q, category: scopeQuery.category });
  const prices = list.map((p) => p.price);

  return {
    categories: facet(list, (p) => [p.category], "alpha", (slug) => categoryName(slug) ?? slug),
    themes: facet(list, (p) => [p.theme]),
    types: facet(list, (p) => [p.type]),
    ages: facet(list, (p) => [p.age], "numeric"),
    interests: facet(list, (p) => p.interests),
    pieces: facet(list, (p) => [p.pieces], "numeric"),
    highlights: facet(list, (p) => [p.highlight]),
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    total: list.length,
  };
}

/** New arrivals. */
export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  return catalogue.filter((p) => p.isNew).slice(0, limit);
}

/** Discounted products, biggest discount first. */
export async function getSaleProducts(limit?: number): Promise<Product[]> {
  const discount = (p: Product) => (p.originalPrice ? (p.originalPrice - p.price) / p.originalPrice : 0);
  const onSale = catalogue.filter((p) => p.isOnSale).sort((a, b) => discount(b) - discount(a));
  return limit === undefined ? onSale : onSale.slice(0, limit);
}

/** Categories in navigation order, with their product count. */
export async function getCategories(): Promise<Category[]> {
  return categoryData.map((c) => ({
    ...c,
    productCount: catalogue.filter((p) => p.category === c.id).length,
  }));
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return (await getCategories()).find((c) => same(c.id, id)) ?? null;
}
