import type { ReactNode } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { SectionHeader } from "./SectionHeader";

interface ProductShowcaseProps {
  id: string;
  eyebrow: string;
  tone?: "info" | "sale";
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  products: Product[];
  className?: string;
}

/**
 * A titled row of product cards (new arrivals, deals) that rise in as they
 * scroll into view; a swipeable row on phones.
 */
export function ProductShowcase({ id, eyebrow, tone, title, description, action, products, className }: ProductShowcaseProps) {
  if (products.length === 0) return null;
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className={cn("py-16 md:py-20", className)}>
      <div className="container-custom">
        <SectionHeader id={titleId} eyebrow={eyebrow} tone={tone} title={title} description={description} action={action} />
        <ProductGrid products={products} reveal="in-view" label={title} mobileLayout="carousel" />
      </div>
    </section>
  );
}
