import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getCategoryById, getPaginatedProducts } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui";
import { ProductList } from "@/components/product";

interface CategoryPageProps {
  params: Promise<{ categoryId: string }>;
}

export async function generateStaticParams() {
  return (await getCategories()).map((category) => ({ categoryId: category.id }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = await getCategoryById((await params).categoryId);
  if (!category) return { title: "Categoría no encontrada" };
  return {
    title: category.name,
    description: `Explora nuestra colección de ${category.name} LEGO: ${category.description.toLowerCase()}.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categoryId } = await params;
  const category = await getCategoryById(categoryId);
  if (!category) notFound();

  const query = { category: category.id };
  const firstPage = await getPaginatedProducts(query);

  return (
    <div className="container-custom py-8">
      <Breadcrumbs items={[{ label: category.name }]} />

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl">{category.name}</h1>
        <p className="mt-2 text-fg-secondary">
          {category.description} · {firstPage.total} {firstPage.total === 1 ? "producto" : "productos"}
        </p>
      </header>

      <ProductList initialPage={firstPage} query={query} />
    </div>
  );
}
