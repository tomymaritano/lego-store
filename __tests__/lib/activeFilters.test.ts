import { describe, it, expect } from "vitest";
import { listActiveFilters, removeFilter, withoutFilters } from "@/lib/productQuery";
import { describeFilter } from "@/components/product/ActiveFilters";
import type { ProductQuery } from "@/types";

const query: ProductQuery = {
  q: "star",
  sort: "price-asc",
  category: "helmet",
  themes: ["Star Wars", "Marvel"],
  ages: ["18+"],
  minPrice: 500,
  maxPrice: 2000,
  minRating: 4.5,
  onSale: true,
  inStock: true,
};

describe("active filters", () => {
  it("lists every filter once, flags first; search text and sort are not filters", () => {
    expect(listActiveFilters(query)).toEqual([
      { field: "inStock" },
      { field: "onSale" },
      { field: "category", value: "helmet" },
      { field: "themes", value: "Star Wars" },
      { field: "themes", value: "Marvel" },
      { field: "ages", value: "18+" },
      { field: "price", min: 500, max: 2000 },
      { field: "minRating", value: 4.5 },
    ]);
    expect(listActiveFilters({ q: "star", sort: "rating" })).toEqual([]);
  });

  it("removes one value of a list, the whole price range, or a flag", () => {
    expect(removeFilter(query, { field: "themes", value: "Marvel" }).themes).toEqual(["Star Wars"]);
    expect(removeFilter({ themes: ["Marvel"] }, { field: "themes", value: "Marvel" })).toEqual({});
    const noPrice = removeFilter(query, { field: "price" });
    expect(noPrice.minPrice).toBeUndefined();
    expect(noPrice.maxPrice).toBeUndefined();
    expect(removeFilter(query, { field: "onSale" }).onSale).toBeUndefined();
    expect(removeFilter(query, { field: "category", value: "helmet" }).category).toBeUndefined();
    // The input is never mutated.
    expect(query.themes).toEqual(["Star Wars", "Marvel"]);
  });

  it("clearing keeps the search text and the sort", () => {
    expect(withoutFilters(query)).toEqual({ q: "star", sort: "price-asc" });
  });

  it("describes chips in Spanish with display names", () => {
    const options = { categories: [{ value: "helmet", label: "Helmets", count: 5 }] };
    expect(describeFilter({ field: "category", value: "helmet" }, options)).toBe("Helmets");
    expect(describeFilter({ field: "onSale" })).toBe("En oferta");
    expect(describeFilter({ field: "minRating", value: 4.5 })).toBe("4,5★ o más");
    expect(describeFilter({ field: "pieces", value: "2001+" })).toBe("2001+ piezas");
    expect(describeFilter({ field: "price", max: 900 })).toMatch(/^Hasta \$/);
    expect(describeFilter({ field: "price", min: 100 })).toMatch(/^Desde \$/);
  });
});
