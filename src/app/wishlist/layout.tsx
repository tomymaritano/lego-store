import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lista de Deseos",
  description: "Tus sets LEGO favoritos guardados. Añade productos a tu carrito cuando estés listo.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
