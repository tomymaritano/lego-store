import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { CheckoutFlow } from "./_components/CheckoutFlow";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Checkout",
    description: "Completa tu compra de forma segura. Envío, pago y confirmación de pedido.",
    path: "/checkout",
  }),
  robots: { index: false, follow: false },
};

/**
 * Checkout. The page shell is a Server Component; the wizard is a client
 * island because the cart and the checkout state live in the browser. The
 * breadcrumbs and h1 live in the island too: once the order is placed the
 * page heading becomes the confirmation itself.
 */
export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="container-custom py-6 md:py-10">
        <CheckoutFlow />
      </div>
    </div>
  );
}
