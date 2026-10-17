import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui";
import { ProductList } from "@/components/product/ProductList";
import { pluralize } from "@/lib/utils";
import type { PaginatedResponse, Product } from "@/types";
import { SectionHeader } from "./SectionHeader";

/** Every set, with infinite scroll; filtering and sorting live on /search. */
export function CatalogSection({ firstPage }: { firstPage: PaginatedResponse<Product> }) {
  return (
    <section id="products" aria-labelledby="products-title" className="bg-bg py-16 md:py-20">
      <div className="container-custom">
        <SectionHeader
          id="products-title"
          eyebrow="Catálogo"
          title="Todos los productos"
          description={`${pluralize(firstPage.total, "set")} disponibles`}
          action={
            <Button variant="secondary" render={<Link href="/search" />}>
              <SlidersHorizontal aria-hidden="true" />
              Filtrar y ordenar
            </Button>
          }
        />
        <ProductList initialPage={firstPage} reveal="in-view" />
      </div>
    </section>
  );
}
