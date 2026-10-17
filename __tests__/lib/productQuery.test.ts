import { describe, it, expect } from "vitest";
import { parseProductQuery, serializeProductQuery } from "@/lib/productQuery";

describe("productQuery", () => {
  it("parses every supported parameter", () => {
    const params = new URLSearchParams(
      "q=%20star%20wars%20&category=helmet&theme=Marvel&theme=Disney,Star%20Wars&age=18%2B&interest=Robots" +
        "&pieces=2001%2B&highlight=Exclusivos&type=Sets&minPrice=100&maxPrice=900&minRating=4" +
        "&inStock=1&onSale=true&isNew=0&sort=price-asc&page=2&limit=6"
    );
    expect(parseProductQuery(params)).toEqual({
      q: "star wars",
      category: "helmet",
      themes: ["Marvel", "Disney", "Star Wars"],
      ages: ["18+"],
      interests: ["Robots"],
      pieces: ["2001+"],
      highlights: ["Exclusivos"],
      types: ["Sets"],
      minPrice: 100,
      maxPrice: 900,
      minRating: 4,
      inStock: true,
      onSale: true,
      sort: "price-asc",
      page: 2,
      limit: 6,
    });
  });

  it("drops invalid values", () => {
    expect(parseProductQuery(new URLSearchParams("sort=cheapest&page=abc&q=%20%20&theme=,"))).toEqual({});
  });

  it("accepts a Next searchParams record", () => {
    expect(parseProductQuery({ theme: ["Marvel", "Disney"], sort: "rating", q: undefined })).toEqual({
      themes: ["Marvel", "Disney"],
      sort: "rating",
    });
  });

  it("round-trips through serialize", () => {
    const query = { q: "rex", themes: ["Star Wars", "Marvel"], onSale: true, page: 3, sort: "name-desc" as const };
    expect(parseProductQuery(serializeProductQuery(query))).toEqual(query);
    expect(serializeProductQuery({}).toString()).toBe("");
  });
});
