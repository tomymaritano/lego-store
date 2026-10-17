import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Checkout",
    description: "Completa tu compra de forma segura. Envío, pago y confirmación de pedido.",
    path: "/checkout",
  }),
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
