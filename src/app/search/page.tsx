"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { products } from "@/data/products";
import { ProductList } from "@/components/product";
import { ProductListSkeleton, Button } from "@/components/ui";

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.theme.toLowerCase().includes(lowerQuery) ||
        p.category.toLowerCase().includes(lowerQuery)
    );
  }, [query]);

  if (!query.trim()) {
    return (
      <div className="container-custom py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 bg-background-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-12 h-12 text-foreground-muted" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-foreground-primary">Busca productos</h1>
          <p className="text-foreground-muted mb-8">
            Usa la barra de búsqueda para encontrar tus sets LEGO favoritos.
          </p>
          <Link href="/">
            <Button size="lg">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Volver a la tienda
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom py-8">
      {/* Header */}
      <div className="mb-8">
        <nav className="text-sm text-foreground-muted mb-4">
          <Link href="/" className="hover:text-lego-blue">
            Inicio
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground-primary">Búsqueda</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground-primary">
          Resultados para &quot;{query}&quot;
        </h1>
        <p className="text-foreground-muted mt-2">
          {results.length} {results.length === 1 ? "producto encontrado" : "productos encontrados"}
        </p>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <ProductList products={results} />
      ) : (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-background-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔍</span>
          </div>
          <h3 className="text-lg font-semibold mb-2 text-foreground-primary">No se encontraron resultados</h3>
          <p className="text-foreground-muted mb-6">
            Intenta con otras palabras clave o explora nuestras categorías.
          </p>
          <Link href="/">
            <Button>Ver todos los productos</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<ProductListSkeleton count={6} />}>
      <SearchContent />
    </Suspense>
  );
}
