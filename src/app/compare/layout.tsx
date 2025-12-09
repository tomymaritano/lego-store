import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparar Productos",
  description: "Compara hasta 4 sets LEGO lado a lado. Analiza precios, piezas y características.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
