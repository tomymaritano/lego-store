// @vitest-environment node
import { describe, expect, it } from "vitest";
import { productQuerySchema, readProductQuery } from "@/lib/api/queryInput";
import { MAX_PRICE } from "@/lib/productQuery";

describe("readProductQuery (server-side zod check of URL queries)", () => {
  it("accepts what the parser makes of hostile URLs: clamped, cleaned, bounded", () => {
    const words = Array.from({ length: 2500 }, (_, i) => `t${i}`).join(" ");
    const params = new URLSearchParams({ q: words, minPrice: "99999999999", maxPrice: "1e12", minRating: "9", category: "\u0000" });
    const query = readProductQuery(params);
    expect(query).toMatchObject({ minPrice: MAX_PRICE, maxPrice: MAX_PRICE, minRating: 5 });
    expect(query?.q?.split(" ")).toHaveLength(8);
    expect(query).not.toHaveProperty("category");
  });

  it("rejects anything the database cannot take, should the parser ever let it through", () => {
    for (const bad of [
      { minPrice: 3_000_000_000 },
      { maxPrice: 10.5 },
      { minRating: 6 },
      { q: "a\u0000b" },
      { q: "x".repeat(101) },
      { category: "\u0000" },
      { themes: Array.from({ length: 21 }, (_, i) => `v${i}`) },
      { sort: "cheapest" },
      { limit: 500 },
      { extra: 1 },
    ]) {
      expect(productQuerySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(productQuerySchema.safeParse({ q: "star wars", minPrice: 0, sort: "rating", page: 2 }).success).toBe(true);
  });
});
