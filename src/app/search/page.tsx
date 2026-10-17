import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Search, SearchX } from "lucide-react";
import { getPaginatedProducts } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";
import { parseProductQuery, serializeProductQuery } from "@/lib/productQuery";
import { Breadcrumbs, Button, EmptyState } from "@/components/ui";
import { ProductList } from "@/components/product";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = parseProductQuery(await searchParams);
  return {
    ...pageMetadata({
      title: q ? `Resultados para "${q}"` : "Buscar productos",
      description: "Busca entre nuestra colección de sets LEGO. Encuentra helmets, brickheadz, vehículos y más.",
      path: q ? `/search?q=${encodeURIComponent(q)}` : "/search",
    }),
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = parseProductQuery(await searchParams);

  if (!query.q) {
    return (
      <div className="container-custom py-16">
        <h1 className="sr-only">Buscar productos</h1>
        <EmptyState
          icon={<Search />}
          title="Busca productos"
          description="Usa la barra de búsqueda para encontrar tus sets LEGO favoritos."
          action={
            <Button size="lg" render={<Link href="/" />}>
              <ChevronLeft aria-hidden="true" />
              Volver a la tienda
            </Button>
          }
        />
      </div>
    );
  }

  const listQuery = { ...query, page: undefined };
  const firstPage = await getPaginatedProducts(listQuery);

  return (
    <div className="container-custom py-8">
      <Breadcrumbs items={[{ label: "Búsqueda" }]} />

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl">Resultados para &quot;{query.q}&quot;</h1>
        <p className="mt-2 text-fg-secondary" aria-live="polite">
          {firstPage.total} {firstPage.total === 1 ? "producto encontrado" : "productos encontrados"}
        </p>
      </header>

      {firstPage.total > 0 ? (
        <section aria-labelledby="search-results-title">
          <h2 id="search-results-title" className="sr-only">
            Productos
          </h2>
          <ProductList key={serializeProductQuery(listQuery).toString()} initialPage={firstPage} query={listQuery} />
        </section>
      ) : (
        <EmptyState
          icon={<SearchX />}
          title="No se encontraron resultados"
          description="Intenta con otras palabras clave o explora nuestras categorías."
          action={<Button render={<Link href="/" />}>Ver todos los productos</Button>}
        />
      )}
    </div>
  );
}
