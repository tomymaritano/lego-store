import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { getCategories, getFilterOptions, getPaginatedProducts } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";
import { parseProductQuery } from "@/lib/productQuery";
import { pluralize } from "@/lib/utils";
import { Breadcrumbs, Button, EmptyState } from "@/components/ui";
import { CatalogView } from "@/components/product";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = parseProductQuery(await searchParams);
  return {
    ...pageMetadata({
      title: q ? `Resultados para "${q}"` : "Catálogo",
      description: q
        ? `Sets LEGO que coinciden con "${q}": filtra por tema, edad, piezas y precio.`
        : "Todo el catálogo de sets LEGO: filtra por tema, categoría, edad, piezas y precio.",
      path: q ? `/search?q=${encodeURIComponent(q)}` : "/search",
    }),
    // Search results are thin, ever-changing pages: let crawlers follow, not index.
    robots: { index: false, follow: true },
  };
}

/**
 * /search?q=… shows the matches for a search; /search alone is the whole
 * catalogue. Both can be narrowed with the filters and sorted; everything
 * lives in the URL (see CatalogView).
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { page: _page, limit: _limit, ...urlQuery } = parseProductQuery(await searchParams);
  void _page;
  void _limit;
  const q = urlQuery.q;

  const [firstPage, options] = await Promise.all([getPaginatedProducts(urlQuery), getFilterOptions({ q })]);

  return (
    <div className="container-custom py-8">
      <Breadcrumbs items={[{ label: q ? "Búsqueda" : "Catálogo" }]} />

      <header className="mb-8">
        {q ? (
          <>
            <p className="text-label tracking-wider text-fg-secondary uppercase">Resultados de búsqueda</p>
            <h1 className="mt-1 text-3xl break-words md:text-4xl">&ldquo;{q}&rdquo;</h1>
          </>
        ) : (
          <h1 className="text-3xl md:text-4xl">Catálogo</h1>
        )}
        <p className="mt-2 text-fg-secondary">
          {q
            ? `${pluralize(options.total, "set encontrado", "sets encontrados")} para tu búsqueda`
            : `${pluralize(options.total, "set")} para armar, regalar y coleccionar`}
        </p>
      </header>

      {options.total > 0 ? (
        <CatalogView key={q ?? ""} initialPage={firstPage} initialQuery={urlQuery} options={options} showCategories />
      ) : (
        <NoResults q={q ?? ""} />
      )}
    </div>
  );
}

/** Nothing matches the search text: suggest themes and categories that do exist. */
async function NoResults({ q }: { q: string }) {
  const [{ themes }, categories] = await Promise.all([getFilterOptions(), getCategories()]);
  const popularThemes = [...themes].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="rounded-2xl border border-dashed border-border-strong" data-testid="search-empty">
      <EmptyState
        icon={<SearchX />}
        title={`No encontramos sets para "${q}"`}
        description="Revisa la ortografía, prueba con menos palabras o explora alguna de estas sugerencias."
        action={<Button render={<Link href="/search" />}>Ver todo el catálogo</Button>}
      />
      <div className="grid gap-8 px-6 pb-10 sm:grid-cols-2 sm:px-10">
        <nav aria-labelledby="suggest-themes-title">
          <h2 id="suggest-themes-title" className="mb-3 text-label text-fg">
            Temas populares
          </h2>
          <ul className="flex flex-wrap gap-2">
            {popularThemes.map((theme) => (
              <li key={theme.value}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  render={<Link href={`/search?q=${encodeURIComponent(theme.value)}`} />}
                >
                  {theme.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="suggest-categories-title">
          <h2 id="suggest-categories-title" className="mb-3 text-label text-fg">
            Categorías
          </h2>
          <ul className="flex flex-wrap gap-2">
            {categories
              .filter((category) => category.productCount > 0)
              .map((category) => (
                <li key={category.id}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    render={<Link href={`/category/${category.id}`} />}
                  >
                    {category.name}
                  </Button>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
