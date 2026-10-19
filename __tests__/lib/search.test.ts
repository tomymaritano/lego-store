import { describe, it, expect } from "vitest";
import { escapeLike, nameHits, normalizeText, productSearchColumns, tokenize } from "@/lib/api/search";

describe("search text", () => {
  it("normalises case, accents and whitespace", () => {
    expect(normalizeText("  Vehículos   ÁRBOL ")).toBe("vehiculos arbol");
    expect(tokenize("Star  WARS star")).toEqual(["star", "wars"]);
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("\u0000")).toEqual([]);
    expect(tokenize("star\u0000wars")).toEqual(["star", "wars"]);
    expect(tokenize(Array.from({ length: 40 }, (_, i) => `t${i}`).join(" "))).toHaveLength(8);
  });

  it("builds the stored search columns from name, theme, category and description", () => {
    const columns = productSearchColumns({
      name: "Batcueva: Caja Sombría",
      theme: "DC",
      categoryId: "cars",
      categoryName: "Vehículos",
      description: "Una  guarida   épica.",
    });
    expect(columns.searchName).toBe("batcueva: caja sombria");
    expect(columns.searchText).toBe("batcueva: caja sombria dc cars vehiculos una guarida epica.");
    for (const term of tokenize("VEHICULOS sombría")) expect(columns.searchText).toContain(term);
  });

  it("counts the terms that hit the name", () => {
    expect(nameHits("captain rex helmet", tokenize("Rex star HELMET"))).toBe(2);
    expect(nameHits("captain rex helmet", [])).toBe(0);
  });

  it("escapes LIKE wildcards in a term", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("star")).toBe("star");
  });
});
