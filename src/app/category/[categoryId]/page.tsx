import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getCategoryById, getFacetCounts, getFilterOptions, getPaginatedProducts } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui";
import { CatalogView } from "@/components/product/CatalogView";
import { pluralize } from "@/lib/utils";
import { pageMetadata } from "@/lib/metadata";

interface CategoryPageProps {
  params: Promise<{ categoryId: string }>;
}

/**
 * Every category is prerendered. Filters and sort in the URL are read on the
 * client by CatalogView, so they never make this route render on demand.
 */
export async function generateStaticParams() {
  return (await getCategories()).map((category) => ({ categoryId: category.id }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = await getCategoryById((await params).categoryId);
  if (!category) return { title: "Categoría no encontrada" };
  // Filtered views share the category's canonical URL.
  return pageMetadata({
    title: category.name,
    description: `Explora nuestra colección de ${category.name} LEGO: ${category.description.toLowerCase()}. ${pluralize(category.productCount, "set")} con envío a todo el país.`,
    path: `/category/${category.id}`,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categoryId } = await params;
  const category = await getCategoryById(categoryId);
  if (!category) notFound();

  // The category comes from the path; the server renders it unfiltered and
  // CatalogView applies any filters or sort in the URL after hydration.
  const scope = { category: category.id };
  const [firstPage, options, counts] = await Promise.all([
    getPaginatedProducts(scope),
    getFilterOptions(scope),
    getFacetCounts(scope),
  ]);

  return (
    <div className="container-custom py-8">
      <Breadcrumbs items={[{ label: category.name }]} />

      <header className="mb-8">
        <h1 className="text-headline">{category.name}</h1>
        <p className="mt-2 text-fg-secondary">
          {category.description} · {pluralize(options.total, "set")}
        </p>
      </header>

      <CatalogView
        initialPage={firstPage}
        initialQuery={{}}
        scope={scope}
        options={options}
        initialCounts={counts}
      />
    </div>
  );
}
