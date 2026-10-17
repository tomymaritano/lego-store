import type { Product } from "@/types";
import { ProductGrid } from "./ProductGrid";

interface RecommendedProductsProps {
  products: Product[];
  title?: string;
  description?: string;
  /** Distinguishes the heading id when a page shows more than one strip. */
  id?: string;
}

/**
 * "Te puede interesar" grid for empty or finished lists (cart, wishlist).
 * Products come from the page's Server Component (lib/api), so nothing is
 * fetched on the client; cards rise in as they scroll into view.
 */
export function RecommendedProducts({
  products,
  title = "Te puede interesar",
  description = "Sets destacados elegidos por nuestro equipo",
  id = "recommended",
}: RecommendedProductsProps) {
  if (products.length === 0) return null;
  const titleId = `${id}-title`;

  return (
    <section aria-labelledby={titleId} className="mt-12 border-t border-border pt-10" data-testid="recommended-products">
      <div className="mb-6">
        <h2 id={titleId} className="text-title text-fg md:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
      </div>
      <ProductGrid products={products} reveal="in-view" columns={4} label={title} />
    </section>
  );
}
