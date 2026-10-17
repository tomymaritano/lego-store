import { describe, it, expect } from "vitest";
import {
  getCategories,
  getCategoryById,
  getFacetCounts,
  getFeaturedProducts,
  getFilterOptions,
  getPaginatedProducts,
  getProductById,
  getProducts,
  getProductsByIds,
  getRelatedProducts,
  getSaleProducts,
  getSearchSuggestions,
  searchProducts,
} from "@/lib/api";
import { normalizeText, tokenize } from "@/lib/api/search";

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("lib/api", () => {
  describe("getProducts / getProductById", () => {
    it("never shows one set's picture on two products", async () => {
      const all = await getProducts();
      const pictures = all.map((p) => p.img).filter((img) => !img.startsWith("/") && !img.startsWith("data:"));
      expect(new Set(pictures).size).toBe(pictures.length);
      // 40623 is the Battle of Endor Heroes set.
      expect(all.find((p) => p.name === "Battle of Endor Heroes")?.img).toMatch(/40623\.png$/);
    });

    it("returns the whole catalogue as a copy", async () => {
      const all = await getProducts();
      expect(all.length).toBeGreaterThan(20);
      all.pop();
      expect((await getProducts()).length).toBe(all.length + 1);
    });

    it("finds a product or returns null", async () => {
      expect((await getProductById("1"))?.name).toBe("Captain Rex Helmet");
      expect(await getProductById("nope")).toBeNull();
    });
  });

  describe("getProductsByIds", () => {
    it("keeps the requested order and skips unknown ids and duplicates", async () => {
      expect(ids(await getProductsByIds(["3", "x", "1", "3"]))).toEqual(["3", "1"]);
    });

    it("returns [] for no ids", async () => {
      expect(await getProductsByIds([])).toEqual([]);
    });
  });

  describe("search", () => {
    it("normalises case, accents and whitespace", () => {
      expect(normalizeText("  Vehículos   ÁRBOL ")).toBe("vehiculos arbol");
      expect(tokenize("Star  WARS star")).toEqual(["star", "wars"]);
      expect(tokenize("   ")).toEqual([]);
    });

    it("requires every term to match", async () => {
      const results = await searchProducts("star wars helmet");
      expect(results.length).toBeGreaterThan(0);
      for (const p of results) {
        expect(p.theme).toBe("Star Wars");
        expect(p.category).toBe("helmet");
      }
      expect(await searchProducts("star wars porsche")).toEqual([]);
    });

    it("matches across name, theme, category and description", async () => {
      expect(ids(await searchProducts("rex"))).toContain("1"); // name
      expect((await searchProducts("technic")).every((p) => p.theme === "Technic")).toBe(true); // theme
      expect((await searchProducts("brickheadz")).length).toBeGreaterThan(0); // category slug
      expect(ids(await searchProducts("fanaticos exhibir"))).toContain("1"); // description, accent-free
    });

    it("is case- and accent-insensitive, and knows category display names", async () => {
      expect(ids(await searchProducts("CAPTAIN rex"))).toEqual(ids(await searchProducts("captain REX")));
      // "Sombría" is written without the accent in the data, "Vehículos" is the display name of "cars".
      expect(ids(await searchProducts("sombría"))).toEqual(ids(await searchProducts("sombria")));
      const cars = await searchProducts("vehiculos");
      expect(cars.length).toBeGreaterThan(0);
      expect(cars.every((p) => p.category === "cars")).toBe(true);
    });

    it("ranks name matches first", async () => {
      const results = await searchProducts("helmet");
      const firstNonName = results.findIndex((p) => !p.name.toLowerCase().includes("helmet"));
      const lastName = results.map((p) => p.name.toLowerCase().includes("helmet")).lastIndexOf(true);
      if (firstNonName !== -1) expect(lastName).toBeLessThan(firstNonName);
    });

    it("returns [] for an empty query and honours limit", async () => {
      expect(await searchProducts("")).toEqual([]);
      expect(await searchProducts("   ")).toEqual([]);
      expect(await searchProducts("star", { limit: 2 })).toHaveLength(2);
    });

    it("builds lightweight autocomplete rows with the total", async () => {
      const { items, total } = await getSearchSuggestions("star wars", 3);
      expect(items).toHaveLength(3);
      expect(total).toBe((await searchProducts("star wars")).length);
      expect(Object.keys(items[0]).sort()).toEqual(["id", "img", "name", "price", "theme"]);
    });
  });

  describe("getPaginatedProducts", () => {
    it("paginates with defaults and reports hasMore / totalPages", async () => {
      const all = await getProducts();
      const first = await getPaginatedProducts({ limit: 10 });
      expect(first.items).toHaveLength(10);
      expect(first).toMatchObject({ total: all.length, page: 1, limit: 10, hasMore: true });
      expect(first.totalPages).toBe(Math.ceil(all.length / 10));

      const last = await getPaginatedProducts({ limit: 10, page: first.totalPages });
      expect(last.hasMore).toBe(false);
      expect(last.items.length).toBe(all.length - 10 * (first.totalPages - 1));

      const beyond = await getPaginatedProducts({ limit: 10, page: 99 });
      expect(beyond.items).toEqual([]);
      expect(beyond.hasMore).toBe(false);
    });

    it("pages never overlap and cover the whole result", async () => {
      const seen: string[] = [];
      for (let page = 1; ; page++) {
        const res = await getPaginatedProducts({ limit: 5, page, sort: "price-asc" });
        seen.push(...ids(res.items));
        if (!res.hasMore) break;
      }
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen.length).toBe((await getProducts()).length);
    });

    it("clamps invalid page and limit", async () => {
      const res = await getPaginatedProducts({ page: -3, limit: 1000 });
      expect(res.page).toBe(1);
      expect(res.limit).toBe(48);
      expect((await getPaginatedProducts({ limit: 0 })).limit).toBe(1);
      expect((await getPaginatedProducts({ limit: Number.NaN })).limit).toBe(12);
    });

    it("filters by category (case-insensitive) and list filters", async () => {
      const helmets = await getPaginatedProducts({ category: "HELMET", limit: 48 });
      expect(helmets.total).toBe(5);
      expect(helmets.items.every((p) => p.category === "helmet")).toBe(true);

      const themed = await getPaginatedProducts({ themes: ["Marvel", "disney"], limit: 48 });
      expect(themed.total).toBe(4);
      expect(themed.items.every((p) => ["Marvel", "Disney"].includes(p.theme))).toBe(true);

      const both = await getPaginatedProducts({ themes: ["Star Wars"], ages: ["18+"], limit: 48 });
      expect(both.items.every((p) => p.theme === "Star Wars" && p.age === "18+")).toBe(true);

      const interests = await getPaginatedProducts({ interests: ["Robots"], limit: 48 });
      expect(interests.items.every((p) => p.interests.includes("Robots"))).toBe(true);

      const pieces = await getPaginatedProducts({ pieces: ["2001+"], highlights: ["Exclusivos"], limit: 48 });
      expect(pieces.items.every((p) => p.pieces === "2001+" && p.highlight === "Exclusivos")).toBe(true);

      const types = await getPaginatedProducts({ types: ["Decoración del hogar"], limit: 48 });
      expect(types.total).toBe(5);
    });

    it("filters by price, rating, stock, sale and new", async () => {
      const ranged = await getPaginatedProducts({ minPrice: 500, maxPrice: 1000, limit: 48 });
      expect(ranged.total).toBeGreaterThan(0);
      expect(ranged.items.every((p) => p.price >= 500 && p.price <= 1000)).toBe(true);

      const rated = await getPaginatedProducts({ minRating: 4.8, limit: 48 });
      expect(rated.items.every((p) => p.rating >= 4.8)).toBe(true);

      const flags = await getPaginatedProducts({ onSale: true, isNew: true, inStock: true, limit: 48 });
      expect(flags.items.every((p) => p.isOnSale && p.isNew && p.stock > 0)).toBe(true);
    });

    it("returns an empty page when nothing matches", async () => {
      const res = await getPaginatedProducts({ category: "unknown" });
      expect(res).toMatchObject({ items: [], total: 0, hasMore: false, totalPages: 1 });
    });

    it("combines search with filters, keeping relevance for featured", async () => {
      const res = await getPaginatedProducts({ q: "star wars", category: "helmet", limit: 48 });
      expect(ids(res.items)).toEqual(ids((await searchProducts("star wars")).filter((p) => p.category === "helmet")));
    });

    it.each([
      ["price-asc", (a: number, b: number) => a <= b, "price"],
      ["price-desc", (a: number, b: number) => a >= b, "price"],
      ["rating", (a: number, b: number) => a >= b, "rating"],
    ] as const)("sorts by %s", async (sort, inOrder, field) => {
      const { items } = await getPaginatedProducts({ sort, limit: 48 });
      for (let i = 1; i < items.length; i++) expect(inOrder(items[i - 1][field], items[i][field])).toBe(true);
    });

    it("sorts by name both ways and puts new products first for newest", async () => {
      const asc = (await getPaginatedProducts({ sort: "name-asc", limit: 48 })).items.map((p) => p.name);
      expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));
      const desc = (await getPaginatedProducts({ sort: "name-desc", limit: 48 })).items.map((p) => p.name);
      expect(desc).toEqual([...asc].reverse());

      const newest = (await getPaginatedProducts({ sort: "newest", limit: 48 })).items;
      const firstOld = newest.findIndex((p) => !p.isNew);
      expect(newest.slice(firstOld).every((p) => !p.isNew)).toBe(true);
    });

    it("featured keeps catalogue order", async () => {
      const { items } = await getPaginatedProducts({ limit: 48 });
      expect(ids(items)).toEqual(ids(await getProducts()));
    });
  });

  describe("getRelatedProducts", () => {
    it("excludes the product, prefers same theme and respects the limit", async () => {
      const related = await getRelatedProducts("1", 4);
      expect(related).toHaveLength(4);
      expect(ids(related)).not.toContain("1");
      expect(related.every((p) => p.theme === "Star Wars" || p.category === "helmet")).toBe(true);
      expect(related[0].theme).toBe("Star Wars");
    });

    it("returns [] for an unknown product", async () => {
      expect(await getRelatedProducts("nope")).toEqual([]);
    });
  });

  describe("getFacetCounts", () => {
    it("matches getFilterOptions when no filter is active", async () => {
      const [counts, options] = await Promise.all([getFacetCounts(), getFilterOptions()]);
      expect(counts.flags).toEqual(options.flags);
      expect(counts.anyCategory).toBe(options.total);
      for (const option of options.themes) expect(counts.themes[option.value]).toBe(option.count);
    });

    it("counts each facet under every other active filter", async () => {
      const counts = await getFacetCounts({ isNew: true });
      // What checking the option would show, i.e. the API total for both filters.
      expect(counts.flags.onSale).toBe((await getPaginatedProducts({ isNew: true, onSale: true })).total);
      expect(counts.categories.helmet).toBe((await getPaginatedProducts({ isNew: true, category: "helmet" })).total);
      expect(counts.anyCategory).toBe((await getPaginatedProducts({ isNew: true })).total);
      // A facet ignores its own selection.
      expect(counts.flags.isNew).toBe((await getFilterOptions()).flags.isNew);
    });

    it("leaves a multi-select facet's own values out (OR), keeps the others in", async () => {
      const counts = await getFacetCounts({ themes: ["Star Wars"], q: "helmet" });
      const all = await getFacetCounts({ q: "helmet" });
      expect(counts.themes).toEqual(all.themes);
      expect(counts.anyRating).toBe((await getPaginatedProducts({ themes: ["Star Wars"], q: "helmet" })).total);
      expect(await getFacetCounts({ q: "zzzz" })).toMatchObject({ themes: {}, anyCategory: 0, flags: { onSale: 0 } });
    });
  });

  describe("getFilterOptions", () => {
    it("lists every value with its count", async () => {
      const options = await getFilterOptions();
      const all = await getProducts();
      expect(options.total).toBe(all.length);
      const starWars = options.themes.find((o) => o.value === "Star Wars");
      expect(starWars?.count).toBe(all.filter((p) => p.theme === "Star Wars").length);
      expect(options.categories.find((o) => o.value === "cars")?.label).toBe("Vehículos");
      expect(options.ages.map((o) => o.value)).toEqual(["12+", "16+", "18+"]);
      expect(options.pieces.map((o) => o.value)).toEqual(["0-500", "501-1000", "1001-2000", "2001+"]);
      expect(options.price.min).toBe(Math.min(...all.map((p) => p.price)));
      expect(options.price.max).toBe(Math.max(...all.map((p) => p.price)));
      // Interests are multi-valued: each product counts once per interest.
      const robots = options.interests.find((o) => o.value === "Robots");
      expect(robots?.count).toBe(all.filter((p) => p.interests.includes("Robots")).length);
    });

    it("counts inside a scope and drops empty values", async () => {
      const helmets = await getFilterOptions({ category: "helmet" });
      expect(helmets.total).toBe(5);
      expect(helmets.themes.map((o) => o.value)).toEqual(["Star Wars"]);

      const none = await getFilterOptions({ q: "zzzz" });
      expect(none).toMatchObject({ total: 0, themes: [], price: { min: 0, max: 0 } });
    });

    it("counts rating thresholds and availability flags", async () => {
      const options = await getFilterOptions();
      const all = await getProducts();
      expect(options.ratings.map((o) => o.value)).toEqual(["4.5", "4", "3"]);
      expect(options.ratings[0]).toMatchObject({
        label: "4,5 estrellas o más",
        count: all.filter((p) => p.rating >= 4.5).length,
      });
      expect(options.flags).toEqual({
        onSale: all.filter((p) => p.isOnSale).length,
        inStock: all.filter((p) => p.stock > 0).length,
        isNew: all.filter((p) => p.isNew).length,
      });
      const none = await getFilterOptions({ q: "zzzz" });
      expect(none.ratings).toEqual([]);
      expect(none.flags).toEqual({ onSale: 0, inStock: 0, isNew: 0 });
    });
  });

  describe("featured, sale and categories", () => {
    it("featured are new products, sale are discounted (biggest first)", async () => {
      expect((await getFeaturedProducts(3)).every((p) => p.isNew)).toBe(true);
      expect(await getFeaturedProducts(3)).toHaveLength(3);
      const sale = await getSaleProducts();
      expect(sale.every((p) => p.isOnSale)).toBe(true);
      expect(await getSaleProducts(1)).toHaveLength(1);
    });

    it("categories carry counts and resolve by id", async () => {
      const categories = await getCategories();
      expect(categories[0]).toMatchObject({ id: "helmet", name: "Helmets", productCount: 5 });
      const total = categories.reduce((sum, c) => sum + c.productCount, 0);
      expect(total).toBe((await getProducts()).length);
      expect((await getCategoryById("cars"))?.name).toBe("Vehículos");
      expect(await getCategoryById("nope")).toBeNull();
    });
  });
});
