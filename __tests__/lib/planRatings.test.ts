import { describe, expect, it } from "vitest";
import { planRatings } from "../../prisma/seed/index";

const average = (ratings: number[]) => Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;

describe("planRatings (seed)", () => {
  it.each([4.8, 4.5, 4.9, 4.2, 3.8, 5, 4.4])("reaches an average of %s with 3 to 8 reviews", (target) => {
    const ratings = planRatings(target, [], 3, 8);
    expect(ratings.length).toBeGreaterThanOrEqual(3);
    expect(ratings.every((r) => Number.isInteger(r) && r >= 1 && r <= 5)).toBe(true);
    expect(average(ratings)).toBe(target);
  });

  it("counts reviews that already exist", () => {
    const ratings = planRatings(4.8, [5, 4], 3, 8);
    expect(average([5, 4, ...ratings])).toBe(4.8);
  });
});
