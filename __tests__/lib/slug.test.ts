import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, drops accents and joins words with single hyphens", () => {
    expect(slugify("Star Wars")).toBe("star-wars");
    expect(slugify("  Vehículos   y Ñandúes!! ")).toBe("vehiculos-y-nandues");
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(80))).toHaveLength(60);
  });
});
