import { beforeEach, describe, expect, it } from "vitest";
import { refreshProductRatings } from "@/lib/api/ratings";
import { resetAndSeed, testDb } from "./setup/db";

beforeEach(async () => {
  await resetAndSeed();
});

const PRODUCT = "5";

async function expectCacheMatchesReviews() {
  const [product, stats] = await Promise.all([
    testDb.product.findUniqueOrThrow({ where: { id: PRODUCT }, select: { rating: true, reviewCount: true } }),
    testDb.review.aggregate({ where: { productId: PRODUCT }, _avg: { rating: true }, _count: true }),
  ]);
  expect(product.reviewCount).toBe(stats._count);
  expect(product.rating).toBeCloseTo(stats._avg.rating ?? 0, 1);
}

const review = (userId: string) => ({ userId, productId: PRODUCT, rating: 1, title: "Flojo", comment: "No me gustó." });

describe("refreshProductRatings", () => {
  it("keeps the cached rating exact when two review transactions overlap", async () => {
    const [first, second] = await Promise.all(
      [1, 2].map((n) => testDb.user.create({ data: { email: `race-${n}@test.local` } }))
    );

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let firstRefreshed!: () => void;
    const refreshed = new Promise<void>((resolve) => (firstRefreshed = resolve));

    // tx1 writes its review and refreshes, then holds its transaction open.
    const tx1 = testDb.$transaction(
      async (tx) => {
        await tx.review.create({ data: review(first.id) });
        await refreshProductRatings(tx, [PRODUCT]);
        firstRefreshed();
        await gate;
      },
      { timeout: 20_000 }
    );
    await refreshed;

    // tx2 does the same while tx1 is still open; its refresh must see tx1's review.
    const tx2 = testDb.$transaction(
      async (tx) => {
        await tx.review.create({ data: review(second.id) });
        await refreshProductRatings(tx, [PRODUCT]);
      },
      { timeout: 20_000 }
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await Promise.all([tx1, tx2]);

    await expectCacheMatchesReviews();
  });

  it("is safe to call outside a transaction", async () => {
    const user = await testDb.user.create({ data: { email: "solo@test.local" } });
    await testDb.review.create({ data: review(user.id) });
    await refreshProductRatings(testDb, [PRODUCT]);
    await expectCacheMatchesReviews();
  });
});
