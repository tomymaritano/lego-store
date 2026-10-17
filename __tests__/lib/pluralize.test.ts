import { describe, it, expect } from "vitest";
import { pluralize } from "@/lib/utils";

describe("pluralize", () => {
  it.each([
    [0, "0 productos"],
    [1, "1 producto"],
    [2, "2 productos"],
  ])("%i → %s", (count, expected) => {
    expect(pluralize(count, "producto")).toBe(expected);
  });

  it("accepts an irregular plural", () => {
    expect(pluralize(3, "opinión", "opiniones")).toBe("3 opiniones");
    expect(pluralize(1, "opinión", "opiniones")).toBe("1 opinión");
  });
});
