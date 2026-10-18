import { beforeAll, describe, expect, it } from "vitest";
import { getProductById, getReviewPage } from "@/lib/api";
import { getReviewPage as readReviewPage } from "@/lib/api/reviews";
import { handwrittenReviews } from "../../prisma/seed/sample-reviews";
import { resetAndSeed, testDb } from "./setup/db";

beforeAll(async () => {
  await resetAndSeed();
});

/** Every review of a product, newest first (one page big enough for all of them). */
const allReviews = async (productId: string) =>
  (await readReviewPage(testDb, productId, { sort: "recent", page: 1, limit: 1000 })).items;

describe("review reads", () => {
  it("serve the same reviews the cached rating and reviewCount are computed from", async () => {
    for (const id of ["1", "11"]) {
      const product = (await getProductById(id))!;
      const reviews = await allReviews(id);
      expect(reviews).toHaveLength(product.reviewCount);
      const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      expect(Math.round(average * 10) / 10).toBe(product.rating);
    }
  });

  it("list newest first, with author names, dates, helpful votes and verified purchases", async () => {
    const reviews = await allReviews("1");
    const dates = reviews.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);

    const rex = handwrittenReviews.find((r) => r.productId === "1" && r.title === "Increíble nivel de detalle")!;
    expect(reviews.find((r) => r.title === rex.title)).toMatchObject({ userName: "Carlos M.", rating: rex.rating, verified: true });

    const votes = await testDb.reviewHelpful.groupBy({ by: ["reviewId"], _count: { _all: true } });
    const byId = new Map(votes.map((v) => [v.reviewId, v._count._all]));
    for (const review of reviews) expect(review.helpful).toBe(byId.get(review.id) ?? 0);
  });

  it("never include the author's account id (the lists are public)", async () => {
    const page = (await getReviewPage("1", "recent"))!;
    expect(page.items.length).toBeGreaterThan(0);
    for (const review of page.items) expect(review).not.toHaveProperty("userId");
    expect(JSON.stringify(page)).not.toMatch(/userId/);
  });

  it("date a review in Argentina's calendar, not UTC's", async () => {
    const user = await testDb.user.create({ data: { email: "noche@resenas.test", name: "Noche" } });
    // 22:30 in Buenos Aires (UTC-3) is already the next day in UTC.
    await testDb.review.create({
      data: { userId: user.id, productId: "2", rating: 4, title: "De noche", comment: "Lo armé a la noche.", createdAt: new Date("2026-10-18T01:30:00Z") },
    });
    const reviews = await allReviews("2");
    expect(reviews.find((r) => r.title === "De noche")?.date).toBe("2026-10-17");
  });

  it("return nothing for an unknown product", async () => {
    expect(await getReviewPage("nope", "recent")).toBeNull();
  });
});
