import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getCategoryById, getFacetCounts, getFilterOptions, getPaginatedProducts } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui";
import { CatalogView } from "@/components/product";
import { parseProductQuery } from "@/lib/productQuery";
import { pluralize } from "@/lib/utils";
import { pageMetadata } from "@/lib/metadata";

interface CategoryPageProps {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { categoryId } = await params;
  const category = await getCategoryById(categoryId);
  if (!category) notFound();

  // The category comes from the path; the URL carries filters and sort only.
  const { category: _ignored, page: _page, limit: _limit, ...urlQuery } = parseProductQuery(await searchParams);
  void _ignored;
  void _page;
  void _limit;
  const scope = { category: category.id };
  const [firstPage, options, counts] = await Promise.all([
    getPaginatedProducts({ ...urlQuery, ...scope }),
    getFilterOptions(scope),
    getFacetCounts({ ...urlQuery, ...scope }),
  ]);

  return (
    <div className="container-custom py-8">
      <Breadcrumbs items={[{ label: category.name }]} />

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl">{category.name}</h1>
        <p className="mt-2 text-fg-secondary">
          {category.description} · {pluralize(options.total, "set")}
        </p>
      </header>

      <CatalogView
        initialPage={firstPage}
        initialQuery={urlQuery}
        scope={scope}
        options={options}
        initialCounts={counts}
      />
    </div>
  );
}
