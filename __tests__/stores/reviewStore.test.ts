import { describe, it, expect, beforeEach } from "vitest";
import { productReviewList, useReviewStore, type Review } from "@/stores/reviewStore";
import { mockReviews } from "../../prisma/seed/mock-reviews";

const own = (id: string, productId: string): Review => ({
  id,
  productId,
  userId: "me",
  userName: "Yo",
  rating: 4,
  title: id,
  comment: "c",
  date: "2026-01-01",
  helpful: 0,
  verified: false,
});

describe("Review Store (the visitor's own reviews and votes)", () => {
  beforeEach(() => {
    useReviewStore.setState({ reviews: [], helpfulVotes: [] });
  });

  it("starts empty: published reviews come from the database", () => {
    expect(useReviewStore.getInitialState().reviews).toEqual([]);
    expect(useReviewStore.getInitialState().helpfulVotes).toEqual([]);
  });

  it("migrates v0/v1: drops the retired mock seeds, keeps user reviews (legacy slugs re-pointed)", async () => {
    localStorage.setItem(
      "lego-reviews-storage",
      JSON.stringify({
        state: {
          reviews: [
            { ...mockReviews[0], id: "r1", productId: "helmet-captain-rex", helpful: 30 },
            { ...mockReviews[3], id: "r4", productId: "brickheadz-mando" },
            { ...mockReviews[0], id: "r999", productId: "helmet-darth-vader" },
            own("u1", "7"),
          ],
        },
        version: 0,
      })
    );
    await useReviewStore.persist.rehydrate();
    const { reviews, helpfulVotes } = useReviewStore.getState();
    expect(reviews.map((r) => [r.id, r.productId])).toEqual([
      ["r999", "3"],
      ["u1", "7"],
    ]);
    expect(helpfulVotes).toEqual([]);
    localStorage.removeItem("lego-reviews-storage");
  });

  it("should add a new review", () => {
    const { addReview, getProductReviews } = useReviewStore.getState();
    addReview({
      productId: "new-test-product",
      userId: "test-user-id",
      userName: "Test User",
      rating: 5,
      title: "Great product!",
      comment: "I love this product.",
      verified: true,
    });
    const [added] = getProductReviews("new-test-product");
    expect(added).toMatchObject({ title: "Great product!", helpful: 0, verified: true });
    expect(added.id).toBeTruthy();
    expect(added.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(useReviewStore.getState().getAverageRating("new-test-product")).toBe(5);
    expect(useReviewStore.getState().getAverageRating("non-existent-product")).toBe(0);
  });

  it("counts one helpful vote per review", () => {
    const { markHelpful } = useReviewStore.getState();
    markHelpful("cuid-1");
    markHelpful("cuid-1");
    expect(useReviewStore.getState().helpfulVotes).toEqual(["cuid-1"]);
  });
});

describe("productReviewList", () => {
  const published = [{ ...own("p1", "1"), helpful: 3 }, own("p2", "1")];

  it("puts the visitor's reviews of this product first and counts their votes", () => {
    const list = productReviewList(published, [own("mine", "1"), own("other", "2")], ["p1"], "1");
    expect(list.map((r) => r.id)).toEqual(["mine", "p1", "p2"]);
    expect(list[1].helpful).toBe(4);
    expect(published[0].helpful).toBe(3);
  });

  it("never lists a review twice", () => {
    expect(productReviewList(published, [published[0]], [], "1")).toHaveLength(2);
  });
});
