import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories, getFeaturedProducts, getPaginatedProducts, getSaleProducts } from "@/lib/api";
import { Button } from "@/components/ui";
import { CatalogSection, CategoriesSection, CtaBanner, HeroSection, ProductShowcase } from "@/components/home";

/** Cards in the "Novedades" and "Ofertas" rows (one row on desktop). */
const SHOWCASE_SIZE = 4;

export default async function HomePage() {
  const [categories, newProducts, saleProducts, allSale, firstPage] = await Promise.all([
    getCategories(),
    getFeaturedProducts(SHOWCASE_SIZE),
    getSaleProducts(SHOWCASE_SIZE),
    getSaleProducts(),
    getPaginatedProducts({ limit: 12 }),
  ]);

  return (
    <div className="min-h-screen">
      <HeroSection productCount={firstPage.total} saleCount={allSale.length} />

      <CategoriesSection categories={categories} />

      <ProductShowcase
        id="novedades"
        eyebrow="Recién llegados"
        title="Novedades"
        description="Los últimos sets que sumamos a la tienda."
        products={newProducts}
        className="bg-bg"
        action={
          <Button variant="link" render={<Link href="/search?isNew=1" />}>
            Ver todas las novedades
            <ArrowRight aria-hidden="true" />
          </Button>
        }
      />

      <ProductShowcase
        id="ofertas"
        eyebrow="Destacados"
        tone="sale"
        title="Ofertas especiales"
        description="Los mayores descuentos primero, mientras haya stock."
        products={saleProducts}
        className="bg-bg-muted"
        action={
          allSale.length > SHOWCASE_SIZE ? (
            <Button variant="link" render={<Link href="/search?onSale=1" />}>
              Ver todas las ofertas
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      <CatalogSection firstPage={firstPage} />

      <CtaBanner />
    </div>
  );
}
