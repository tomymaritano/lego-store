import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { CompareView } from "@/components/compare/CompareView";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Comparar Productos",
    description: "Compara hasta 4 sets LEGO lado a lado. Analiza precios, piezas y características.",
    path: "/compare",
  }),
  robots: { index: false, follow: true },
};

/**
 * The compare list lives in localStorage (ids), so the table renders in the
 * CompareView island, which hydrates the products by id through the by-ids
 * Route Handler (lib/api).
 */
export default function ComparePage() {
  return <CompareView />;
}
