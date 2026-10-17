import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { getFeaturedProducts } from "@/lib/api";
import { WishlistView } from "@/components/wishlist/WishlistView";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Favoritos",
    description: "Tus sets LEGO favoritos guardados. Añade productos a tu carrito cuando estés listo.",
    path: "/wishlist",
  }),
  robots: { index: false, follow: true },
};

/** Products suggested when the wishlist is empty. */
const RECOMMENDED_COUNT = 4;

/**
 * Saved products live in localStorage, so the list renders in the
 * WishlistView island (hydrated by id through the by-ids Route Handler); the
 * server provides the recommended products for the empty state.
 */
export default async function WishlistPage() {
  const recommended = await getFeaturedProducts(RECOMMENDED_COUNT);
  return <WishlistView recommended={recommended} />;
}
