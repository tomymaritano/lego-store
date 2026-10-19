import { describe, expect, it } from "vitest";
import { collectionBadgeLabel } from "@/lib/collection";

describe("collectionBadgeLabel", () => {
  it("names one product's collection in singular, the same on its card and its page", () => {
    expect(collectionBadgeLabel("Exclusivos")).toBe("Exclusivo");
    expect(collectionBadgeLabel("Destacados")).toBe("Destacado");
    expect(collectionBadgeLabel("Edición Limitada")).toBe("Edición limitada");
  });

  it("shows a collection it doesn't know as stored", () => {
    expect(collectionBadgeLabel("Novedades 2026")).toBe("Novedades 2026");
  });
});
