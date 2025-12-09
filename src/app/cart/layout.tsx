import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carrito de Compras",
  description: "Revisa los productos en tu carrito de compras. Modifica cantidades o procede al checkout.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
