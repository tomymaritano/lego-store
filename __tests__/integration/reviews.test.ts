import { beforeAll, describe, expect, it } from "vitest";
import { getProductById, getProductReviews } from "@/lib/api";
import { handwrittenReviews } from "../../prisma/seed/sample-reviews";
import { resetAndSeed, testDb } from "./setup/db";

beforeAll(async () => {
  await resetAndSeed();
});

describe("getProductReviews", () => {
  it("serves the same reviews the cached rating and reviewCount are computed from", async () => {
    for (const id of ["1", "11"]) {
      const product = (await getProductById(id))!;
      const reviews = await getProductReviews(id);
      expect(reviews).toHaveLength(product.reviewCount);
      const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      expect(Math.round(average * 10) / 10).toBe(product.rating);
    }
  });

  it("lists newest first, with author names, dates, helpful votes and verified purchases", async () => {
    const reviews = await getProductReviews("1");
    const dates = reviews.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);

    const rex = handwrittenReviews.find((r) => r.productId === "1" && r.title === "Increíble nivel de detalle")!;
    expect(reviews.find((r) => r.title === rex.title)).toMatchObject({ userName: "Carlos M.", rating: rex.rating, verified: true });

    const votes = await testDb.reviewHelpful.groupBy({ by: ["reviewId"], _count: { _all: true } });
    const byId = new Map(votes.map((v) => [v.reviewId, v._count._all]));
    for (const review of reviews) expect(review.helpful).toBe(byId.get(review.id) ?? 0);
  });

  it("returns nothing for an unknown product", async () => {
    expect(await getProductReviews("nope")).toEqual([]);
  });
});
