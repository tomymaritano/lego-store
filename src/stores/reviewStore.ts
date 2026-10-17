import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Review } from "@/types";
import { isRecord, persistStorage } from "./persist";
import { mockReviews } from "./mockReviews";

// Re-exported for the reviews UI, which imports it from the store today.
export type { Review };
export { mockReviews };

/*
 * Reviews are mock, client-side data until the backend lands (it replaces
 * this store with real endpoints).
 */

interface ReviewState {
  reviews: Review[];
  addReview: (review: Omit<Review, "id" | "date" | "helpful">) => void;
  getProductReviews: (productId: string) => Review[];
  getAverageRating: (productId: string) => number;
  markHelpful: (reviewId: string) => void;
}


/** v0 seeds pointed at slugs that never existed in the catalogue. */
const LEGACY_PRODUCT_IDS: Record<string, string> = {
  "helmet-captain-rex": "1",
  "helmet-darth-vader": "3",
  "brickheadz-mando": "4",
};

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: mockReviews,

      addReview: (reviewData) => {
        const newReview: Review = {
          ...reviewData,
          id: `r${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          helpful: 0,
        };
        set((state) => ({ reviews: [newReview, ...state.reviews] }));
      },

      getProductReviews: (productId) => get().reviews.filter((r) => r.productId === productId),

      getAverageRating: (productId) => {
        const productReviews = get().reviews.filter((r) => r.productId === productId);
        if (productReviews.length === 0) return 0;
        const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
        return Math.round((sum / productReviews.length) * 10) / 10;
      },

      markHelpful: (reviewId) =>
        set((state) => ({
          reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, helpful: r.helpful + 1 } : r)),
        })),
    }),
    {
      name: "lego-reviews-storage",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ reviews: state.reviews }),
      migrate: (persisted) => ({ reviews: migrateReviews(isRecord(persisted) ? persisted.reviews : undefined) }),
    }
  )
);

/** Re-points legacy seed ids and refreshes the seeds' copy; user reviews are kept. */
function migrateReviews(value: unknown): Review[] {
  if (!Array.isArray(value)) return mockReviews;
  const seeds = new Map(mockReviews.map((r) => [r.id, r]));
  return value
    .filter((r): r is Review => isRecord(r) && typeof r.id === "string" && typeof r.productId === "string")
    .map((r) => {
      const seed = seeds.get(r.id);
      if (seed) return { ...seed, helpful: Math.max(seed.helpful, r.helpful ?? 0) };
      return { ...r, productId: LEGACY_PRODUCT_IDS[r.productId] ?? r.productId };
    });
}
