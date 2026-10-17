import { describe, it, expect, beforeEach } from "vitest";
import { mockReviews, useReviewStore } from "@/stores/reviewStore";

describe("Review Store", () => {
  beforeEach(() => {
    useReviewStore.setState({ reviews: mockReviews });
  });

  it("seed reviews point at real catalogue products", async () => {
    const { getProducts } = await import("@/lib/api");
    const ids = new Set((await getProducts()).map((p) => p.id));
    expect(mockReviews.every((r) => ids.has(r.productId))).toBe(true);
    expect(useReviewStore.getState().getProductReviews("1")).toHaveLength(2);
  });

  it("migrates v0 seeds with legacy slugs and keeps user reviews", async () => {
    localStorage.setItem(
      "lego-reviews-storage",
      JSON.stringify({
        state: {
          reviews: [
            { ...mockReviews[0], productId: "helmet-captain-rex", helpful: 30 },
            { ...mockReviews[3], productId: "brickheadz-mando" },
            { ...mockReviews[0], id: "r999", productId: "helmet-darth-vader" },
            { id: "u1", productId: "7", userId: "x", userName: "Ana", rating: 4, title: "t", comment: "c", date: "2024-01-01", helpful: 0, verified: false },
          ],
        },
        version: 0,
      })
    );
    await useReviewStore.persist.rehydrate();
    const reviews = useReviewStore.getState().reviews;
    expect(reviews.map((r) => [r.id, r.productId])).toEqual([
      ["r1", "1"],
      ["r4", "4"],
      ["r999", "3"],
      ["u1", "7"],
    ]);
    expect(reviews[0].helpful).toBe(30);
  });

  it("should get reviews for a specific product", () => {
    const { getProductReviews } = useReviewStore.getState();

    const reviews = getProductReviews("1");

    expect(Array.isArray(reviews)).toBe(true);
  });

  it("should calculate average rating for a product", () => {
    const { getAverageRating } = useReviewStore.getState();

    const avgRating = getAverageRating("1");

    expect(typeof avgRating).toBe("number");
    expect(avgRating).toBeGreaterThanOrEqual(0);
    expect(avgRating).toBeLessThanOrEqual(5);
  });

  it("should return 0 average rating for product with no reviews", () => {
    const { getAverageRating } = useReviewStore.getState();

    const avgRating = getAverageRating("non-existent-product");

    expect(avgRating).toBe(0);
  });

  it("should add a new review", () => {
    const { addReview, getProductReviews } = useReviewStore.getState();
    const newProductId = "new-test-product";

    const initialCount = getProductReviews(newProductId).length;

    addReview({
      productId: newProductId,
      userId: "test-user-id",
      userName: "Test User",
      rating: 5,
      title: "Great product!",
      comment: "I love this product.",
      verified: false,
    });

    const reviews = useReviewStore.getState().getProductReviews(newProductId);
    expect(reviews.length).toBe(initialCount + 1);
    expect(reviews[0].title).toBe("Great product!");
  });

  it("should mark a review as helpful", () => {
    const { reviews, markHelpful } = useReviewStore.getState();

    if (reviews.length > 0) {
      const reviewId = reviews[0].id;
      const initialHelpful = reviews[0].helpful;

      markHelpful(reviewId);

      const updatedReview = useReviewStore.getState().reviews.find(r => r.id === reviewId);
      expect(updatedReview?.helpful).toBe(initialHelpful + 1);
    }
  });

  it("should include required fields when adding a review", () => {
    const { addReview } = useReviewStore.getState();
    const productId = "test-product-fields";

    addReview({
      productId,
      userId: "test-user-id",
      userName: "Test User",
      rating: 4,
      title: "Good product",
      comment: "Very nice product.",
      verified: true,
    });

    const reviews = useReviewStore.getState().getProductReviews(productId);
    const addedReview = reviews[0];

    expect(addedReview).toHaveProperty("id");
    expect(addedReview).toHaveProperty("date");
    expect(addedReview).toHaveProperty("helpful");
    expect(addedReview).toHaveProperty("verified");
    expect(addedReview.userName).toBe("Test User");
    expect(addedReview.rating).toBe(4);
    expect(addedReview.verified).toBe(true);
  });
});
