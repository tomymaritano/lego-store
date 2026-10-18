import type { Metadata } from "next";
import { connection } from "next/server";
import { pageMetadata } from "@/lib/metadata";
import { paymentsClientConfig } from "@/lib/payments/config";
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
 *
 * Rendered per request: which payment provider is configured (Stripe, the
 * test mock, or none) is read from the server's environment at runtime.
 */
export default async function CheckoutPage() {
  await connection();
  const payments = paymentsClientConfig();
  return (
    <div className="min-h-screen bg-bg-subtle" data-payments-mode={payments.mode}>
      <div className="container-custom py-6 md:py-10">
        <CheckoutFlow payments={payments} />
      </div>
    </div>
  );
}
