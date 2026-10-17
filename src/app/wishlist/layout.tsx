import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Lista de Deseos",
    description: "Tus sets LEGO favoritos guardados. Añade productos a tu carrito cuando estés listo.",
    path: "/wishlist",
  }),
  robots: { index: false, follow: true },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
