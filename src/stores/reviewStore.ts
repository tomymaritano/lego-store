import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  helpful: number;
  verified: boolean;
}

interface ReviewState {
  reviews: Review[];
  addReview: (review: Omit<Review, "id" | "date" | "helpful">) => void;
  getProductReviews: (productId: string) => Review[];
  getAverageRating: (productId: string) => number;
  markHelpful: (reviewId: string) => void;
}

// Mock reviews data
const mockReviews: Review[] = [
  {
    id: "r1",
    productId: "helmet-captain-rex",
    userId: "u1",
    userName: "Carlos M.",
    rating: 5,
    title: "Increíble nivel de detalle",
    comment: "El casco de Captain Rex es impresionante. Los detalles de las marcas de batalla son perfectos. La construcción fue divertida y el resultado final es espectacular para exhibir.",
    date: "2024-01-15",
    helpful: 12,
    verified: true,
  },
  {
    id: "r2",
    productId: "helmet-captain-rex",
    userId: "u2",
    userName: "Ana L.",
    rating: 4,
    title: "Muy bueno pero algo difícil",
    comment: "Excelente set para fans de Clone Wars. La construcción es algo desafiante en algunas partes pero vale la pena el esfuerzo.",
    date: "2024-01-10",
    helpful: 8,
    verified: true,
  },
  {
    id: "r3",
    productId: "helmet-darth-vader",
    userId: "u3",
    userName: "Roberto G.",
    rating: 5,
    title: "El mejor helmet de la colección",
    comment: "Vader siempre impresiona. Este set no decepciona - imponente y con un acabado premium.",
    date: "2024-02-01",
    helpful: 15,
    verified: true,
  },
  {
    id: "r4",
    productId: "brickheadz-mando",
    userId: "u4",
    userName: "María S.",
    rating: 5,
    title: "¡Adorable!",
    comment: "Perfecto para mi escritorio. El Grogu que viene con Mando es demasiado tierno.",
    date: "2024-01-20",
    helpful: 20,
    verified: false,
  },
];

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
        set((state) => ({
          reviews: [newReview, ...state.reviews],
        }));
      },

      getProductReviews: (productId) => {
        return get().reviews.filter((r) => r.productId === productId);
      },

      getAverageRating: (productId) => {
        const productReviews = get().reviews.filter((r) => r.productId === productId);
        if (productReviews.length === 0) return 0;
        const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
        return Math.round((sum / productReviews.length) * 10) / 10;
      },

      markHelpful: (reviewId) => {
        set((state) => ({
          reviews: state.reviews.map((r) =>
            r.id === reviewId ? { ...r, helpful: r.helpful + 1 } : r
          ),
        }));
      },
    }),
    {
      name: "lego-reviews-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
