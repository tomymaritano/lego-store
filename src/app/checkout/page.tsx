import { Breadcrumbs } from "@/components/ui";
import { CheckoutFlow } from "./_components/CheckoutFlow";

/**
 * Checkout. The page shell is a Server Component; the wizard is a client
 * island because the cart and the checkout state live in the browser.
 */
export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="container-custom py-6 md:py-10">
        <Breadcrumbs items={[{ label: "Carrito", href: "/cart" }, { label: "Checkout" }]} />
        <h1 className="mt-4 mb-8 text-3xl md:text-4xl">Finalizar compra</h1>
        <CheckoutFlow />
      </div>
    </div>
  );
}
