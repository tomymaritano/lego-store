import type { ProductQuery, SortOption } from "@/types";

/**
 * ProductQuery <-> URL search params. Shared by the pages (searchParams), the
 * Route Handlers (request.nextUrl.searchParams) and the client islands that
 * call them, so a query means the same thing everywhere. Client-safe: no data,
 * and no zod (it would add ~20 kB to every page's first load); the Route
 * Handlers re-check the result with a zod schema (lib/api/queryInput.ts).
 *
 * Lists accept repeated keys or commas: ?theme=Marvel&theme=Disney or
 * ?theme=Marvel,Disney. Booleans are "1"/"true".
 *
 * Every value is validated and bounded here, before it reaches the database:
 * prices are integers inside Postgres int4, the rating is 0..5, the free text
 * is capped (MAX_SEARCH_LENGTH characters, MAX_SEARCH_TERMS words: each word
 * is one LIKE clause per facet query), lists hold at most MAX_FILTER_VALUES
 * values, and control characters (Postgres rejects NUL in text) never pass.
 */

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Destacados" },
  { value: "newest", label: "Más nuevos" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "rating", label: "Mejor calificados" },
  { value: "name-asc", label: "Nombre: A-Z" },
  { value: "name-desc", label: "Nombre: Z-A" },
];

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;
/** Most ids GET /api/products/by-ids resolves per request; the rest are ignored. */
export const MAX_IDS_PER_REQUEST = 50;

/** Longest search text kept (characters, after cleanSearchText). */
export const MAX_SEARCH_LENGTH = 100;
/** Most search words kept; the rest are ignored. */
export const MAX_SEARCH_TERMS = 8;
/** Most values per list filter (theme, age, …); the rest are ignored. */
export const MAX_FILTER_VALUES = 20;
/** Longest filter value or category slug accepted (longer ones match nothing, so they are dropped). */
export const MAX_FILTER_VALUE_LENGTH = 60;
/** Highest price bound: prices are Postgres int4 (integer pesos). */
export const MAX_PRICE = 2_147_483_647;

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((o) => o.value));

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const CONTROL_CHARS_ALL = /[\u0000-\u001f\u007f]/g;

/**
 * Free text as the store searches it: control characters become spaces,
 * whitespace collapses, at most MAX_SEARCH_TERMS words and MAX_SEARCH_LENGTH
 * characters. "" when nothing is left.
 */
export function cleanSearchText(raw: string): string {
  return raw
    .replace(CONTROL_CHARS_ALL, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS)
    .join(" ")
    .slice(0, MAX_SEARCH_LENGTH)
    .trim();
}

/** A category slug or list filter value: short, no control characters. */
export const isValidFilterValue = (value: string) =>
  value.length > 0 && value.length <= MAX_FILTER_VALUE_LENGTH && !CONTROL_CHARS.test(value);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A finite number from the URL, rounded and clamped; null for anything else (NaN, ±Infinity, ""). */
const bounded =
  (round: (n: number) => number, min: number, max: number) =>
  (raw: string): number | null => {
    const n = Number(raw);
    return raw.trim() !== "" && Number.isFinite(n) ? clamp(round(n), min, max) : null;
  };

const NUMBER_PARSERS = {
  // Bounds stay inclusive on whole pesos: 10.5 as a minimum means 11, as a maximum 10.
  minPrice: bounded(Math.ceil, 0, MAX_PRICE),
  maxPrice: bounded(Math.floor, 0, MAX_PRICE),
  minRating: bounded((n) => n, 0, 5),
  page: bounded(Math.trunc, 1, Number.MAX_SAFE_INTEGER),
  limit: bounded(Math.trunc, 1, MAX_PAGE_SIZE),
} as const;

/** URL key for each list filter. */
const LIST_KEYS = {
  themes: "theme",
  types: "type",
  ages: "age",
  interests: "interest",
  pieces: "pieces",
  highlights: "highlight",
} as const satisfies Partial<Record<keyof ProductQuery, string>>;

const NUMBER_KEYS = ["minPrice", "maxPrice", "minRating", "page", "limit"] as const;
const BOOLEAN_KEYS = ["inStock", "onSale", "isNew"] as const;

type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function getAll(params: ParamsInput, key: string): string[] {
  const raw =
    params instanceof URLSearchParams
      ? params.getAll(key)
      : ([] as string[]).concat(params[key] ?? []);
  return raw
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

function getOne(params: ParamsInput, key: string): string | undefined {
  return getAll(params, key)[0];
}

/** Parses search params into a ProductQuery, dropping anything invalid. */
export function parseProductQuery(params: ParamsInput): ProductQuery {
  const query: ProductQuery = {};

  const q = cleanSearchText((params instanceof URLSearchParams ? params.get("q") : [params.q ?? ""].flat()[0]) ?? "");
  if (q) query.q = q;

  const category = getOne(params, "category");
  if (category && isValidFilterValue(category)) query.category = category;

  for (const [field, key] of Object.entries(LIST_KEYS) as [keyof typeof LIST_KEYS, string][]) {
    const values = Array.from(new Set(getAll(params, key)))
      .filter(isValidFilterValue)
      .slice(0, MAX_FILTER_VALUES);
    if (values.length) query[field] = values;
  }

  for (const key of NUMBER_KEYS) {
    const raw = getOne(params, key);
    if (raw === undefined) continue;
    const value = NUMBER_PARSERS[key](raw);
    if (value !== null) query[key] = value;
  }

  for (const key of BOOLEAN_KEYS) {
    const raw = getOne(params, key);
    if (raw === "1" || raw === "true") query[key] = true;
  }

  const sort = getOne(params, "sort");
  if (sort && SORT_VALUES.has(sort)) query.sort = sort as SortOption;

  return query;
}

/** Serialises a ProductQuery; omits empty values so URLs stay short. */
export function serializeProductQuery(query: ProductQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  for (const [field, key] of Object.entries(LIST_KEYS) as [keyof typeof LIST_KEYS, string][]) {
    for (const value of query[field] ?? []) params.append(key, value);
  }
  for (const key of NUMBER_KEYS) {
    const value = query[key];
    if (value !== undefined) params.set(key, String(value));
  }
  for (const key of BOOLEAN_KEYS) {
    if (query[key]) params.set(key, "1");
  }
  if (query.sort) params.set("sort", query.sort);
  return params;
}

// ---------------------------------------------------------------------------
// Active filters (chips, "clear all")
// ---------------------------------------------------------------------------

type ListFilterField = keyof typeof LIST_KEYS;

/** One removable filter of a query. Price is one chip for its min and max. */
export type ActiveFilter =
  | { field: "category"; value: string }
  | { field: ListFilterField; value: string }
  | { field: "price"; min?: number; max?: number }
  | { field: "minRating"; value: number }
  | { field: (typeof BOOLEAN_KEYS)[number] };

/** The filters set in a query, in display order. Search text and sort are not filters. */
export function listActiveFilters(query: ProductQuery): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  for (const field of BOOLEAN_KEYS) if (query[field]) active.push({ field });
  if (query.category) active.push({ field: "category", value: query.category });
  for (const field of Object.keys(LIST_KEYS) as ListFilterField[]) {
    for (const value of query[field] ?? []) active.push({ field, value });
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    active.push({ field: "price", min: query.minPrice, max: query.maxPrice });
  }
  if (query.minRating !== undefined) active.push({ field: "minRating", value: query.minRating });
  return active;
}

/** The query without one filter. */
export function removeFilter(query: ProductQuery, filter: ActiveFilter): ProductQuery {
  const next = { ...query };
  switch (filter.field) {
    case "price":
      delete next.minPrice;
      delete next.maxPrice;
      return next;
    case "category":
    case "minRating":
    case "inStock":
    case "onSale":
    case "isNew":
      delete next[filter.field];
      return next;
    default: {
      const rest = (query[filter.field] ?? []).filter((value) => value !== filter.value);
      if (rest.length) next[filter.field] = rest;
      else delete next[filter.field];
      return next;
    }
  }
}

/** The query with every filter removed: keeps the search text and the sort. */
export function withoutFilters(query: ProductQuery): ProductQuery {
  const next: ProductQuery = {};
  if (query.q) next.q = query.q;
  if (query.sort) next.sort = query.sort;
  return next;
}
