// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheCalls: { keyParts: string[]; tags: string[]; revalidate: number | false | undefined }[] = [];

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, keyParts: string[], options: { tags: string[]; revalidate?: number }) => {
    cacheCalls.push({ keyParts, tags: options.tags, revalidate: options.revalidate });
    return async () => "cached";
  },
  revalidateTag: vi.fn(),
}));

const { revalidateTag } = await import("next/cache");
const { CATALOG_TAGS, invalidateCatalog } = await import("@/lib/api/cache");
const api = await import("@/lib/api/products");

beforeEach(() => {
  cacheCalls.length = 0;
  vi.mocked(revalidateTag).mockClear();
});

describe("catalogue data cache", () => {
  it("tags a product read with the catalogue and the product", async () => {
    await expect(api.getProductById("7")).resolves.toBe("cached");
    expect(cacheCalls).toEqual([{ keyParts: ["getProductById", '["7"]'], tags: ["products", "product:7"], revalidate: 3600 }]);
  });

  it("keys list reads by their arguments and tags them with the catalogue", async () => {
    await api.getPaginatedProducts({ q: "star", sort: "rating" });
    await api.getPaginatedProducts({ q: "star", sort: "price-asc" });
    expect(cacheCalls.map((c) => c.keyParts[1])).toEqual(['[{"q":"star","sort":"rating"}]', '[{"q":"star","sort":"price-asc"}]']);
    expect(cacheCalls.every((c) => c.tags.includes(CATALOG_TAGS.products))).toBe(true);
  });

  it("tags category reads with categories and products (their counts)", async () => {
    await api.getCategories();
    await api.getFilterOptions({ category: "cars" });
    for (const call of cacheCalls) expect(call.tags).toEqual(expect.arrayContaining(["categories", "products"]));
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
