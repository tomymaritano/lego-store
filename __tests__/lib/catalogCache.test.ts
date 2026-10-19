// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheCalls: { keyParts: string[]; tags: string[]; revalidate: number | false | undefined }[] = [];

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, keyParts: string[], options: { tags: string[]; revalidate?: number }) => {
    cacheCalls.push({ keyParts, tags: options.tags, revalidate: options.revalidate });
    return fn;
  },
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));

const category = (id: string) => ({ id, name: id, description: "", image: "", productCount: 1 });
const product = (id: string) => ({ id });

vi.mock("@/lib/api/catalog", () => ({
  getProducts: vi.fn(async () => []),
  getProductIds: vi.fn(async () => ["3", "7", "9"]),
  getProductById: vi.fn(async (_db: unknown, id: string) => product(id)),
  searchProducts: vi.fn(async () => []),
  getSearchSuggestions: vi.fn(async () => ({ items: [], total: 0 })),
  getPaginatedProducts: vi.fn(async () => ({ items: [] })),
  getRelatedProducts: vi.fn(async () => []),
  getFilterOptions: vi.fn(async () => ({})),
  getFacetCounts: vi.fn(async () => ({})),
  getFeaturedProducts: vi.fn(async () => []),
  getSaleProducts: vi.fn(async () => []),
  getCategories: vi.fn(async () => [category("star-wars"), category("cars")]),
}));

const { revalidateTag } = await import("next/cache");
const { CATALOG_TAGS, invalidateCatalog } = await import("@/lib/api/cache");
const api = await import("@/lib/api/products");

/** Cache keys written by the last calls, minus the lookups that bound them. */
const entries = () =>
  cacheCalls.filter((c) => !["getProductIds", "getCategories"].includes(c.keyParts[0])).map((c) => c.keyParts.join(" "));

beforeEach(() => {
  cacheCalls.length = 0;
  vi.mocked(revalidateTag).mockClear();
});

describe("catalogue data cache", () => {
  it("tags a product read with the catalogue and the product", async () => {
    await expect(api.getProductById("7")).resolves.toEqual({ id: "7" });
    expect(cacheCalls.find((c) => c.keyParts[0] === "getProductById")).toEqual({
      keyParts: ["getProductById", '["7"]'],
      tags: ["products", "product:7"],
      revalidate: 3600,
    });
  });

  it("does not cache unknown product ids", async () => {
    await expect(api.getProductById("no-such-set")).resolves.toBeNull();
    expect(entries()).toEqual([]);
  });

  it("builds by-ids reads from the per-product entries", async () => {
    await expect(api.getProductsByIds(["9", "x", "3", "9"])).resolves.toEqual([{ id: "9" }, { id: "3" }]);
    expect(entries()).toEqual(['getProductById ["9"]', 'getProductById ["3"]']);
  });

  it("caches the unfiltered first page of a known category or of the catalogue", async () => {
    await api.getPaginatedProducts({ category: "cars" });
    await api.getPaginatedProducts({ limit: 12 });
    await api.getPaginatedProducts({ category: "cars", sort: "rating" });
    expect(entries()).toEqual([
      'getPaginatedProducts [{"category":"cars"}]',
      'getPaginatedProducts [{"limit":12}]',
      'getPaginatedProducts [{"category":"cars","sort":"rating"}]',
    ]);
    expect(cacheCalls.every((c) => c.tags.includes(CATALOG_TAGS.products))).toBe(true);
  });

  it.each([
    ["search text", { q: "star" }],
    ["price bounds", { minPrice: 17 }],
    ["filter values", { themes: ["anything"] }],
    ["a later page", { page: 2 }],
    ["a custom page size", { limit: 48 }],
    ["an unknown category", { category: "made-up" }],
  ])("runs listings with %s uncached", async (_label, query) => {
    await api.getPaginatedProducts(query);
    await api.getFacetCounts(query);
    expect(entries()).toEqual([]);
  });

  it("never caches search and suggestions", async () => {
    await api.searchProducts("x-wing");
    await api.getSearchSuggestions("x-wing", 5);
    await api.getFilterOptions({ q: "x-wing" });
    expect(entries()).toEqual([]);
  });

  it("tags category reads with categories and products (their counts)", async () => {
    await api.getCategories();
    await api.getFilterOptions({ category: "cars" });
    await expect(api.getCategoryById("CARS")).resolves.toMatchObject({ id: "cars" });
    await expect(api.getCategoryById("nope")).resolves.toBeNull();
    for (const call of cacheCalls) expect(call.tags).toEqual(expect.arrayContaining(["categories", "products"]));
    expect(entries()).toEqual(['getFilterOptions [{"category":"cars"}]']);
  });

  it("invalidates with immediate expiry", () => {
    invalidateCatalog({ productIds: ["3", "9"], categories: true });
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      ["products", { expire: 0 }],
      ["product:3", { expire: 0 }],
      ["product:9", { expire: 0 }],
      ["categories", { expire: 0 }],
    ]);
    vi.mocked(revalidateTag).mockClear();
    invalidateCatalog();
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([["products", { expire: 0 }]]);
  });
});
