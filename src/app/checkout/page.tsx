import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/metadata";
import { MOCK_PROVIDER_COOKIE, checkoutPaymentsConfig, paymentsUnavailable } from "@/lib/payments/config";
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
 * Rendered per request: which payment provider takes the order (Mercado
 * Pago or Stripe, PAYMENT_PROVIDER) and how it is set up (credentials, the
 * test mock, or none) are read from the server's environment at runtime.
 */
export default async function CheckoutPage() {
  await connection();
  // The cookie only counts where the payments mock runs (tests): see lib/payments/config.ts.
  const mockProvider = (await cookies()).get(MOCK_PROVIDER_COOKIE)?.value;
  const payments = checkoutPaymentsConfig(process.env, mockProvider);
  // The signed-in customer's name and email prefill the shipping step (same request-cached session read as the layout).
  const user = await getCurrentUser();
  const account = user ? { name: user.name, email: user.email } : null;
  return (
    <div className="min-h-screen bg-bg-subtle" data-payments-mode={payments.mode} data-payments-provider={payments.provider}>
      <div className="container-custom py-6 md:py-10">
        <CheckoutFlow payments={payments} unavailable={paymentsUnavailable(process.env, mockProvider)} account={account} />
      </div>
    </div>
  );
}
