import type { ProductQuery, SortOption } from "@/types";

/**
 * ProductQuery <-> URL search params. Shared by the pages (searchParams), the
 * Route Handlers (request.nextUrl.searchParams) and the client islands that
 * call them, so a query means the same thing everywhere. Client-safe: no data.
 *
 * Lists accept repeated keys or commas: ?theme=Marvel&theme=Disney or
 * ?theme=Marvel,Disney. Booleans are "1"/"true".
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

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((o) => o.value));

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

  const q = (params instanceof URLSearchParams ? params.get("q") : [params.q ?? ""].flat()[0])?.trim();
  if (q) query.q = q;

  const category = getOne(params, "category");
  if (category) query.category = category;

  for (const [field, key] of Object.entries(LIST_KEYS) as [keyof typeof LIST_KEYS, string][]) {
    const values = Array.from(new Set(getAll(params, key)));
    if (values.length) query[field] = values;
  }

  for (const key of NUMBER_KEYS) {
    const raw = getOne(params, key);
    if (raw === undefined) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) query[key] = value;
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
