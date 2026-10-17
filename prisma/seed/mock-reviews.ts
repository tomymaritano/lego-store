import type { Review } from "@/types";

/*
 * The handwritten demo reviews (they used to ship in the client review store;
 * the product page now reads them from the database). Seed source only:
 * ./sample-reviews.ts attributes each one to the sample user with the same
 * userName. The id and helpful fields are not seeded (the database assigns
 * ids, and "útil" votes are seeded as ReviewHelpful rows).
 */

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
