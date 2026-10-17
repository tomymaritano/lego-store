import { describe, it, expect } from "vitest";
import {
  MAX_FILTER_VALUES,
  MAX_PAGE_SIZE,
  MAX_PRICE,
  MAX_SEARCH_LENGTH,
  MAX_SEARCH_TERMS,
  cleanSearchText,
  parseProductQuery,
  serializeProductQuery,
} from "@/lib/productQuery";

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

  it("clamps numbers to what the database can compare (int4 prices, 0-5 rating, page size)", () => {
    expect(parseProductQuery(new URLSearchParams("minPrice=99999999999&maxPrice=1e12&minRating=9&page=0&limit=500"))).toEqual({
      minPrice: MAX_PRICE,
      maxPrice: MAX_PRICE,
      minRating: 5,
      page: 1,
      limit: MAX_PAGE_SIZE,
    });
    expect(parseProductQuery(new URLSearchParams("minPrice=-5&maxPrice=10.9&minRating=-1&page=2.7"))).toEqual({
      minPrice: 0,
      maxPrice: 10,
      minRating: 0,
      page: 2,
    });
    expect(parseProductQuery(new URLSearchParams("minPrice=10.1&maxPrice=1e400&minRating=Infinity"))).toEqual({ minPrice: 11 });
  });

  it("drops control characters: Postgres rejects NUL in text", () => {
    expect(parseProductQuery(new URLSearchParams("q=%00&category=%00&theme=%00,Marvel"))).toEqual({ themes: ["Marvel"] });
    expect(parseProductQuery(new URLSearchParams("q=star%00wars")).q).toBe("star wars");
  });

  it("caps the search text, the number of terms and the list sizes", () => {
    const words = Array.from({ length: 50 }, (_, i) => `t${i}`).join(" ");
    const q = parseProductQuery(new URLSearchParams({ q: words })).q!;
    expect(q.split(" ")).toHaveLength(MAX_SEARCH_TERMS);
    expect(cleanSearchText("x".repeat(5000))).toHaveLength(MAX_SEARCH_LENGTH);

    const themes = Array.from({ length: 100 }, (_, i) => `theme=v${i}`).join("&");
    expect(parseProductQuery(new URLSearchParams(themes)).themes).toHaveLength(MAX_FILTER_VALUES);
    expect(parseProductQuery(new URLSearchParams({ category: "c".repeat(500) }))).toEqual({});
  });
});
