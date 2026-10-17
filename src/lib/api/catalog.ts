import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_PAGE_SIZE, MAX_IDS_PER_REQUEST, MAX_PAGE_SIZE } from "@/lib/productQuery";
import type {
  Category,
  FacetCounts,
  FilterOption,
  FilterOptions,
  PaginatedResponse,
  Product,
  ProductFilters,
  ProductQuery,
  SearchSuggestion,
} from "@/types";
import { escapeLike, nameHits, normalizeText, tokenize } from "./search";

/*
 * Catalogue queries on Prisma, uncached. ./products.ts wraps each one in the
 * Next data cache for the app; the integration tests call them through it with
 * the cache stubbed out. Every function takes the client first so tests can
 * hand in a client on the test database.
 *
 * Filtering, search, sorting and pagination run in Postgres. Two things are
 * finished in JS over narrow rows: the relevance ranking of "Destacados"
 * (name hits per term) and the sale order (biggest discount first).
 */

type Db = PrismaClient;

export type Query = ProductQuery;

const productSelect = {
  id: true,
  name: true,
  price: true,
  originalPrice: true,
  isNew: true,
  isOnSale: true,
  rating: true,
  reviewCount: true,
  categoryId: true,
  type: true,
  age: true,
  theme: true,
  interests: true,
  pieces: true,
  highlight: true,
  img: true,
  imageSecondary: true,
  images: true,
  stock: true,
  shortDescription: true,
  description: true,
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

/** DB row -> the app's Product (optional fields left out rather than null). */
function toProduct({ categoryId, originalPrice, imageSecondary, ...row }: ProductRow): Product {
  return {
    ...row,
    category: categoryId,
    ...(originalPrice !== null && { originalPrice }),
    ...(imageSecondary !== null && { imageSecondary }),
  };
}

/** Catalogue order: creation order ("Destacados" without a search). */
const catalogueOrder: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];

const ORDER_BY: Record<Exclude<ProductQuery["sort"], "featured" | undefined>, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ isNew: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  "price-asc": [{ price: "asc" }, ...catalogueOrder],
  "price-desc": [{ price: "desc" }, ...catalogueOrder],
  rating: [{ rating: "desc" }, ...catalogueOrder],
  // searchName is the lowercase, accent-free name: a collation-independent A-Z.
  "name-asc": [{ searchName: "asc" }, { id: "asc" }],
  "name-desc": [{ searchName: "desc" }, { id: "desc" }],
};

// ---------------------------------------------------------------------------
// Filters -> WHERE
// ---------------------------------------------------------------------------

const LIST_FIELDS = {
  themes: "theme",
  types: "type",
  ages: "age",
  pieces: "pieces",
  highlights: "highlight",
  interests: "interests",
} as const;

type ListFilter = keyof typeof LIST_FIELDS;
type Vocabulary = Record<(typeof LIST_FIELDS)[ListFilter], string[]>;

/**
 * Every distinct value of the list facets. URL filter values are matched to
 * these ignoring case and accents ("disney" -> "Disney"), so the WHERE can use
 * exact, indexable comparisons.
 */
async function loadVocabulary(db: Db): Promise<Vocabulary> {
  const rows = await db.$queryRaw<{ field: keyof Vocabulary; value: string }[]>`
    SELECT DISTINCT 'theme' AS field, "theme" AS value FROM "Product"
    UNION SELECT DISTINCT 'type', "type" FROM "Product"
    UNION SELECT DISTINCT 'age', "age" FROM "Product"
    UNION SELECT DISTINCT 'pieces', "pieces" FROM "Product"
    UNION SELECT DISTINCT 'highlight', "highlight" FROM "Product"
    UNION SELECT DISTINCT 'interests', unnest("interests") FROM "Product"
  `;
  const vocabulary: Vocabulary = { theme: [], type: [], age: [], pieces: [], highlight: [], interests: [] };
  for (const { field, value } of rows) vocabulary[field].push(value);
  return vocabulary;
}

function canonical(known: string[], requested: string[]): string[] {
  const wanted = new Set(requested.map(normalizeText));
  return known.filter((value) => wanted.has(normalizeText(value)));
}

type Scope = Pick<ProductQuery, "q"> & ProductFilters;

/** Builds WHERE clauses for a scope; loads the facet vocabulary once, only if a list filter needs it. */
function whereBuilder(db: Db) {
  let vocabulary: Promise<Vocabulary> | null = null;

  return async function where(query: Scope): Promise<Prisma.ProductWhereInput> {
    const and: Prisma.ProductWhereInput[] = [];

    for (const term of tokenize(query.q ?? "")) and.push({ searchText: { contains: escapeLike(term) } });
    if (query.category) and.push({ categoryId: { equals: query.category, mode: "insensitive" } });

    for (const [filter, field] of Object.entries(LIST_FIELDS) as [ListFilter, keyof Vocabulary][]) {
      const requested = query[filter];
      if (!requested?.length) continue;
      vocabulary ??= loadVocabulary(db);
      const values = canonical((await vocabulary)[field], requested);
      and.push(field === "interests" ? { interests: { hasSome: values } } : { [field]: { in: values } });
    }

    if (query.minPrice !== undefined) and.push({ price: { gte: query.minPrice } });
    if (query.maxPrice !== undefined) and.push({ price: { lte: query.maxPrice } });
    if (query.minRating !== undefined) and.push({ rating: { gte: query.minRating } });
    if (query.inStock) and.push({ stock: { gt: 0 } });
    if (query.onSale) and.push({ isOnSale: true });
    if (query.isNew) and.push({ isNew: true });

    return { AND: and };
  };
}

// ---------------------------------------------------------------------------
// Ranking ("Destacados") and fetching by id
// ---------------------------------------------------------------------------

/**
 * Ids in scope in "Destacados" order: products with reviews first, then (when
 * searching) more query terms in the name, then catalogue order.
 */
async function featuredIds(db: Db, where: Prisma.ProductWhereInput, q: string | undefined): Promise<string[]> {
  const rows = await db.product.findMany({
    where,
    select: { id: true, searchName: true, reviewCount: true },
    orderBy: catalogueOrder,
  });
  const terms = tokenize(q ?? "");
  return rows
    .map((row, index) => ({ id: row.id, reviewed: row.reviewCount > 0 ? 1 : 0, hits: nameHits(row.searchName, terms), index }))
    .sort((a, b) => b.reviewed - a.reviewed || b.hits - a.hits || a.index - b.index)
    .map((row) => row.id);
}

/** Full products for `ids`, in that order (missing ids skipped). */
async function productsInOrder(db: Db, ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({ where: { id: { in: ids } }, select: productSelect });
  const byId = new Map(rows.map((row) => [row.id, toProduct(row)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
}

const MAX_OFFSET = 2_147_483_647;

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function getProducts(db: Db): Promise<Product[]> {
  const rows = await db.product.findMany({ select: productSelect, orderBy: catalogueOrder });
  return rows.map(toProduct);
}

/** Every product id (for bounding cache keys to ids that exist). */
export async function getProductIds(db: Db): Promise<string[]> {
  const rows = await db.product.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  return rows.map((row) => row.id);
}

export async function getProductById(db: Db, id: string): Promise<Product | null> {
  const row = await db.product.findUnique({ where: { id }, select: productSelect });
  return row ? toProduct(row) : null;
}

export async function getProductsByIds(db: Db, ids: string[]): Promise<Product[]> {
  return productsInOrder(db, Array.from(new Set(ids)).slice(0, MAX_IDS_PER_REQUEST));
}

export async function searchProducts(db: Db, query: string, options: { limit?: number } = {}): Promise<Product[]> {
  if (tokenize(query).length === 0) return [];
  const ids = await featuredIds(db, await whereBuilder(db)({ q: query }), query);
  return productsInOrder(db, options.limit === undefined ? ids : ids.slice(0, Math.max(0, options.limit)));
}

export async function getSearchSuggestions(
  db: Db,
  query: string,
  limit = 5
): Promise<{ items: SearchSuggestion[]; total: number }> {
  if (tokenize(query).length === 0) return { items: [], total: 0 };
  const ids = await featuredIds(db, await whereBuilder(db)({ q: query }), query);
  const items = await db.product.findMany({
    where: { id: { in: ids.slice(0, Math.max(0, limit)) } },
    select: { id: true, name: true, price: true, img: true, theme: true },
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    items: ids.slice(0, Math.max(0, limit)).flatMap((id) => byId.get(id) ?? []),
    total: ids.length,
  };
}

export async function getPaginatedProducts(db: Db, query: ProductQuery = {}): Promise<PaginatedResponse<Product>> {
  const limit = clampInt(query.limit, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1);
  const start = (page - 1) * limit;
  const where = await whereBuilder(db)(query);

  let items: Product[];
  let total: number;
  if (!query.sort || query.sort === "featured") {
    const ids = await featuredIds(db, where, query.q);
    total = ids.length;
    items = await productsInOrder(db, ids.slice(start, start + limit));
  } else {
    const [rows, count] = await Promise.all([
      // A page past any plausible catalogue is empty without asking for an out-of-range OFFSET.
      start > MAX_OFFSET
        ? []
        : db.product.findMany({ where, select: productSelect, orderBy: ORDER_BY[query.sort], skip: start, take: limit }),
      db.product.count({ where }),
    ]);
    items = rows.map(toProduct);
    total = count;
  }

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasMore: start + limit < total,
  };
}

/** Same theme and category first, then same theme, then same category; best rated first within each. */
export async function getRelatedProducts(db: Db, productId: string, limit = 4): Promise<Product[]> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { theme: true, categoryId: true } });
  if (!product) return [];

  const tiers: Prisma.ProductWhereInput[] = [
    { theme: product.theme, categoryId: product.categoryId },
    { theme: product.theme, categoryId: { not: product.categoryId } },
    { theme: { not: product.theme }, categoryId: product.categoryId },
  ];
  const related: Product[] = [];
  for (const tier of tiers) {
    if (related.length >= limit) break;
    const rows = await db.product.findMany({
      where: { ...tier, id: { not: productId } },
      select: productSelect,
      orderBy: [{ rating: "desc" }, ...catalogueOrder],
      take: limit - related.length,
    });
    related.push(...rows.map(toProduct));
  }
  return related;
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

/** Thresholds offered by the rating filter, highest first. */
const RATING_THRESHOLDS = [4.5, 4, 3] as const;

/** Leading number of "12+", "501-1000", "2001+" for natural ordering. */
const leadingNumber = (value: string) => Number.parseInt(value, 10) || 0;

type ScalarFacet = "categoryId" | "theme" | "type" | "age" | "pieces" | "highlight";

/** Products per value of one column, inside `where`. */
async function countByColumn(db: Db, field: ScalarFacet, where: Prisma.ProductWhereInput): Promise<Record<string, number>> {
  const groups = await db.product.groupBy({ by: [field], where, _count: { _all: true } });
  return Object.fromEntries(groups.map((group) => [group[field], group._count._all]));
}

/** Products per interest (multi-valued: a product counts once per interest it has). */
async function countInterests(db: Db, where: Prisma.ProductWhereInput): Promise<Record<string, number>> {
  const rows = await db.product.findMany({ where, select: { interests: true } });
  const counts: Record<string, number> = {};
  for (const { interests } of rows) for (const value of new Set(interests)) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

async function countRatings(db: Db, where: Prisma.ProductWhereInput): Promise<Record<string, number>> {
  const counts = await Promise.all(
    RATING_THRESHOLDS.map((stars) => db.product.count({ where: { AND: [where, { rating: { gte: stars } }] } }))
  );
  return Object.fromEntries(RATING_THRESHOLDS.map((stars, i) => [String(stars), counts[i]]));
}

function options(
  counts: Record<string, number>,
  order: "alpha" | "numeric" = "alpha",
  label: (value: string) => string = (v) => v
): FilterOption[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) =>
      order === "numeric" ? leadingNumber(a.value) - leadingNumber(b.value) : a.label.localeCompare(b.label, "es")
    );
}

export async function getFilterOptions(
  db: Db,
  scopeQuery: Pick<ProductQuery, "q" | "category"> = {}
): Promise<FilterOptions> {
  const where = await whereBuilder(db)({ q: scopeQuery.q, category: scopeQuery.category });
  const and = (extra: Prisma.ProductWhereInput) => ({ AND: [where, extra] });

  const [categories, names, themes, types, ages, interests, pieces, highlights, price, ratings, onSale, inStock, isNew, total] =
    await Promise.all([
      countByColumn(db, "categoryId", where),
      db.category.findMany({ select: { id: true, name: true } }),
      countByColumn(db, "theme", where),
      countByColumn(db, "type", where),
      countByColumn(db, "age", where),
      countInterests(db, where),
      countByColumn(db, "pieces", where),
      countByColumn(db, "highlight", where),
      db.product.aggregate({ where, _min: { price: true }, _max: { price: true } }),
      countRatings(db, where),
      db.product.count({ where: and({ isOnSale: true }) }),
      db.product.count({ where: and({ stock: { gt: 0 } }) }),
      db.product.count({ where: and({ isNew: true }) }),
      db.product.count({ where }),
    ]);
  const categoryName = new Map(names.map((c) => [c.id, c.name]));

  return {
    categories: options(categories, "alpha", (slug) => categoryName.get(slug) ?? slug),
    themes: options(themes),
    types: options(types),
    ages: options(ages, "numeric"),
    interests: options(interests),
    pieces: options(pieces, "numeric"),
    highlights: options(highlights),
    price: { min: price._min.price ?? 0, max: price._max.price ?? 0 },
    ratings: RATING_THRESHOLDS.map((stars) => ({
      value: String(stars),
      label: `${String(stars).replace(".", ",")} estrellas o más`,
      count: ratings[String(stars)],
    })).filter((option) => option.count > 0),
    flags: { onSale, inStock, isNew },
    total,
  };
}

export async function getFacetCounts(db: Db, query: ProductQuery = {}): Promise<FacetCounts> {
  const where = whereBuilder(db);
  const without = (field: keyof ProductFilters) => where({ ...query, [field]: undefined });

  const [byCategory, byTheme, byType, byAge, byInterest, byPieces, byHighlight, byRating, bySale, byStock, byNew] =
    await Promise.all([
      without("category"),
      without("themes"),
      without("types"),
      without("ages"),
      without("interests"),
      without("pieces"),
      without("highlights"),
      without("minRating"),
      without("onSale"),
      without("inStock"),
      without("isNew"),
    ]);
  const and = (base: Prisma.ProductWhereInput, extra: Prisma.ProductWhereInput) => ({ AND: [base, extra] });

  const [categories, themes, types, ages, interests, pieces, highlights, ratings, onSale, inStock, isNew, anyCategory, anyRating] =
    await Promise.all([
      countByColumn(db, "categoryId", byCategory),
      countByColumn(db, "theme", byTheme),
      countByColumn(db, "type", byType),
      countByColumn(db, "age", byAge),
      countInterests(db, byInterest),
      countByColumn(db, "pieces", byPieces),
      countByColumn(db, "highlight", byHighlight),
      countRatings(db, byRating),
      db.product.count({ where: and(bySale, { isOnSale: true }) }),
      db.product.count({ where: and(byStock, { stock: { gt: 0 } }) }),
      db.product.count({ where: and(byNew, { isNew: true }) }),
      db.product.count({ where: byCategory }),
      db.product.count({ where: byRating }),
    ]);

  return {
    categories,
    themes,
    types,
    ages,
    interests,
    pieces,
    highlights,
    ratings,
    flags: { onSale, inStock, isNew },
    anyCategory,
    anyRating,
  };
}

// ---------------------------------------------------------------------------
// Home rails and categories
// ---------------------------------------------------------------------------

export async function getFeaturedProducts(db: Db, limit = 8): Promise<Product[]> {
  const rows = await db.product.findMany({
    where: { isNew: true },
    select: productSelect,
    orderBy: catalogueOrder,
    take: Math.max(0, limit),
  });
  return rows.map(toProduct);
}

export async function getSaleProducts(db: Db, limit?: number): Promise<Product[]> {
  const take = limit === undefined ? null : Math.max(0, Math.trunc(limit));
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Product"
    WHERE "isOnSale" AND "originalPrice" IS NOT NULL
    ORDER BY ("originalPrice" - "price")::float8 / "originalPrice" DESC, "createdAt", "id"
    LIMIT ${take}
  `;
  return productsInOrder(db, rows.map((row) => row.id));
}

export async function getCategories(db: Db): Promise<Category[]> {
  const rows = await db.category.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true, name: true, description: true, image: true, _count: { select: { products: true } } },
  });
  return rows.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
}

export async function getCategoryById(db: Db, id: string): Promise<Category | null> {
  const row = await db.category.findFirst({
    where: { id: { equals: id, mode: "insensitive" } },
    select: { id: true, name: true, description: true, image: true, _count: { select: { products: true } } },
  });
  if (!row) return null;
  const { _count, ...category } = row;
  return { ...category, productCount: _count.products };
}
