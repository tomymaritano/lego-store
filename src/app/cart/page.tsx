import type { Metadata } from "next";
import { connection } from "next/server";
import { pageMetadata } from "@/lib/metadata";
import { getFeaturedProducts } from "@/lib/api";
import { paymentsUnavailable } from "@/lib/payments/config";
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
 * the server only provides the recommended products for the empty state, and
 * whether the store can take payments (read from the environment on each
 * request, like the checkout).
 */
export default async function CartPage() {
  await connection();
  const recommended = await getFeaturedProducts(RECOMMENDED_COUNT);
  return <CartView recommended={recommended} paymentsUnavailable={paymentsUnavailable()} />;
}
