import { getFeaturedProducts } from "@/lib/api";
import { WishlistView } from "@/components/wishlist/WishlistView";

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
