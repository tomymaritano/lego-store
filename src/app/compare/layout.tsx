import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Comparar Productos",
    description: "Compara hasta 4 sets LEGO lado a lado. Analiza precios, piezas y características.",
    path: "/compare",
  }),
  robots: { index: false, follow: true },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
