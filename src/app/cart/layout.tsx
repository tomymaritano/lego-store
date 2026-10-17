import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Carrito de Compras",
    description: "Revisa los productos en tu carrito de compras. Modifica cantidades o procede al checkout.",
    path: "/cart",
  }),
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
