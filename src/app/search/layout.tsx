import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buscar Productos",
  description: "Busca entre nuestra colección de sets LEGO. Encuentra helmets, brickheadz, vehículos y más.",
  openGraph: {
    title: "Buscar Productos | LEGO Store",
    description: "Encuentra tu próximo set LEGO favorito.",
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
