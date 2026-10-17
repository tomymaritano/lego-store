import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { getFeaturedProducts } from "@/lib/api";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Carrito de Compras",
    description: "Revisa los productos en tu carrito de compras. Modifica cantidades o procede al checkout.",
    path: "/cart",
  }),
  robots: { index: false, follow: true },
};

/** Products suggested when the cart is empty. */
const RECOMMENDED_COUNT = 4;

/**
 * The cart lives in localStorage, so its lines render in the CartView island;
 * the server only provides the recommended products for the empty state.
 */
export default async function CartPage() {
  const recommended = await getFeaturedProducts(RECOMMENDED_COUNT);
  return <CartView recommended={recommended} />;
}
