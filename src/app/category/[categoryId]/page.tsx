import { notFound } from "next/navigation";
import { products } from "@/data/products";
import { ProductList } from "@/components/product";

interface CategoryPageProps {
  params: Promise<{ categoryId: string }>;
}

const categoryNames: Record<string, string> = {
  helmet: "Helmets",
  brickheadz: "Brickheadz",
  cars: "Vehículos",
};

export async function generateMetadata({ params }: CategoryPageProps) {
  const { categoryId } = await params;
  const name = categoryNames[categoryId] || categoryId;

  return {
    title: `${name} | LEGO Store`,
    description: `Explora nuestra colección de ${name} LEGO`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categoryId } = await params;

  const categoryProducts = products.filter(
    (p) => p.category.toLowerCase() === categoryId.toLowerCase()
  );

  if (categoryProducts.length === 0 && !categoryNames[categoryId]) {
    notFound();
  }

  const categoryName = categoryNames[categoryId] || categoryId;

  return (
    <div className="container-custom py-8">
      {/* Header */}
      <div className="mb-8">
        <nav className="text-sm text-gray-500 mb-4">
          <a href="/" className="hover:text-lego-blue">
            Inicio
          </a>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{categoryName}</span>
        </nav>

        <h1 className="text-3xl font-bold">{categoryName}</h1>
        <p className="text-gray-600 mt-2">
          {categoryProducts.length} productos encontrados
        </p>
      </div>

      {/* Products */}
      <ProductList products={categoryProducts} />
    </div>
  );
}
