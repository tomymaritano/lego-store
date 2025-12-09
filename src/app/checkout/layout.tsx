import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Completa tu compra de forma segura. Envío, pago y confirmación de pedido.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
