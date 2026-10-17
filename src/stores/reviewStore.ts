import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Review } from "@/types";
import { isRecord, persistStorage } from "./persist";

export type { Review };

/*
 * The visitor's own review activity, kept in the browser until the reviews
 * stage stores it on the server: the reviews they wrote and the reviews they
 * marked "útil". The product's published reviews come from the database
 * (lib/api getProductReviews, rendered by the product page); the UI shows
 * those plus the visitor's own (see productReviewList).
 */

interface ReviewState {
  /** Reviews this visitor wrote, newest first. */
  reviews: Review[];
  /** Ids of the reviews this visitor marked "útil" (published or their own). */
  helpfulVotes: string[];
  addReview: (review: Omit<Review, "id" | "date" | "helpful">) => void;
  getProductReviews: (productId: string) => Review[];
  getAverageRating: (productId: string) => number;
  /** Counts one vote per review; later calls for the same review do nothing. */
  markHelpful: (reviewId: string) => void;
}

/** v0 seeds pointed at slugs that never existed in the catalogue. */
const LEGACY_PRODUCT_IDS: Record<string, string> = {
  "helmet-captain-rex": "1",
  "helmet-darth-vader": "3",
  "brickheadz-mando": "4",
};

/** Ids of the mock reviews v0/v1 shipped in the store; the database serves them now. */
const RETIRED_SEED_IDS = new Set(["r1", "r2", "r3", "r4"]);

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: [],
      helpfulVotes: [],

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
        set((state) => (state.helpfulVotes.includes(reviewId) ? state : { helpfulVotes: [...state.helpfulVotes, reviewId] })),
    }),
    {
      name: "lego-reviews-storage",
      version: 2,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ reviews: state.reviews, helpfulVotes: state.helpfulVotes }),
      migrate: (persisted) => ({
        reviews: migrateReviews(isRecord(persisted) ? persisted.reviews : undefined),
        helpfulVotes: migrateVotes(isRecord(persisted) ? persisted.helpfulVotes : undefined),
      }),
    }
  )
);

/** Keeps the visitor's own reviews (legacy slugs re-pointed); drops the retired mock seeds. */
function migrateReviews(value: unknown): Review[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is Review => isRecord(r) && typeof r.id === "string" && typeof r.productId === "string")
    .filter((r) => !RETIRED_SEED_IDS.has(r.id))
    .map((r) => ({ ...r, productId: LEGACY_PRODUCT_IDS[r.productId] ?? r.productId }));
}

function migrateVotes(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.filter((id): id is string => typeof id === "string"))) : [];
}

/**
 * What a product's reviews tab lists: the visitor's own reviews of it first,
 * then the published ones, each with the visitor's "útil" vote counted.
 */
export function productReviewList(
  published: readonly Review[],
  own: readonly Review[],
  helpfulVotes: readonly string[],
  productId: string
): Review[] {
  const voted = new Set(helpfulVotes);
  const publishedIds = new Set(published.map((r) => r.id));
  return [...own.filter((r) => r.productId === productId && !publishedIds.has(r.id)), ...published].map((r) =>
    voted.has(r.id) ? { ...r, helpful: r.helpful + 1 } : r
  );
}
