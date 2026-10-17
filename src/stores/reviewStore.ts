import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Review } from "@/types";
import { isRecord, persistStorage } from "./persist";

// Re-exported for the reviews UI, which imports it from the store today.
export type { Review };

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

/** Seed reviews; productId matches the catalogue ids in src/data/products.ts. */
export const mockReviews: Review[] = [
  {
    id: "r1",
    productId: "1",
    userId: "u1",
    userName: "Carlos M.",
    rating: 5,
    title: "Increíble nivel de detalle",
    comment:
      "El casco de Captain Rex es impresionante. Los detalles de las marcas de batalla son perfectos. La construcción fue divertida y el resultado final es espectacular para exhibir.",
    date: "2024-01-15",
    helpful: 12,
    verified: true,
  },
  {
    id: "r2",
    productId: "1",
    userId: "u2",
    userName: "Ana L.",
    rating: 4,
    title: "Muy bueno pero algo difícil",
    comment:
      "Excelente set para fans de Clone Wars. La construcción es algo desafiante en algunas partes pero vale la pena el esfuerzo.",
    date: "2024-01-10",
    helpful: 8,
    verified: true,
  },
  {
    id: "r3",
    productId: "3",
    userId: "u3",
    userName: "Roberto G.",
    rating: 5,
    title: "El mejor helmet de la colección",
    comment: "Cody siempre impresiona. Este set no decepciona: imponente y con un acabado premium.",
    date: "2024-02-01",
    helpful: 15,
    verified: true,
  },
  {
    id: "r4",
    productId: "4",
    userId: "u4",
    userName: "María S.",
    rating: 5,
    title: "¡Espectacular en la repisa!",
    comment: "Perfecto para mi escritorio. El casco de Mando tiene un acabado brillante que llama la atención.",
    date: "2024-01-20",
    helpful: 20,
    verified: false,
  },
];

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
