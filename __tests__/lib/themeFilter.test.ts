import { describe, expect, it } from "vitest";
import { canonicalizeThemes } from "@/lib/themeFilter";

const themes = [
  { value: "star-wars", label: "Star Wars", count: 9 },
  { value: "harry-potter", label: "Harry Potter", count: 4 },
];

describe("canonicalizeThemes", () => {
  it("turns a theme's name into its slug, ignoring case and accents", () => {
    expect(canonicalizeThemes({ themes: ["Star Wars"] }, themes)).toEqual({ themes: ["star-wars"] });
    expect(canonicalizeThemes({ themes: ["HARRY  pótter"], sort: "price-asc" }, themes)).toEqual({
      themes: ["harry-potter"],
      sort: "price-asc",
    });
  });

  it("keeps slugs and unknown values, and drops duplicates a name and its slug make", () => {
    expect(canonicalizeThemes({ themes: ["Star Wars", "star-wars", "hidden-theme"] }, themes)).toEqual({
      themes: ["star-wars", "hidden-theme"],
    });
  });

  it("returns the same object when nothing changes", () => {
    const query = { themes: ["star-wars"] };
    expect(canonicalizeThemes(query, themes)).toBe(query);
    const empty = { q: "nave" };
    expect(canonicalizeThemes(empty, themes)).toBe(empty);
  });
});
