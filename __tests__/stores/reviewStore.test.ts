import { describe, it, expect, beforeEach } from "vitest";
import { useReviewStore } from "@/stores/reviewStore";

describe("Review Store", () => {
  beforeEach(() => {
    // Reset to initial state with mock reviews
    const initialReviews = useReviewStore.getState().reviews.filter(r =>
      r.productId === "75349" || r.productId === "75351"
    );
    useReviewStore.setState({ reviews: initialReviews });
  });

  it("should get reviews for a specific product", () => {
    const { getProductReviews } = useReviewStore.getState();

    const reviews = getProductReviews("75349");

    expect(Array.isArray(reviews)).toBe(true);
  });

  it("should calculate average rating for a product", () => {
    const { getAverageRating } = useReviewStore.getState();

    const avgRating = getAverageRating("75349");

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
    const { addReview, getProductReviews } = useReviewStore.getState();
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
