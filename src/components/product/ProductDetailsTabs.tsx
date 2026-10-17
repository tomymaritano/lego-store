"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReviewStore } from "@/stores/reviewStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { REVIEWS_HASH } from "./anchors";
import { ProductReviews } from "./ProductReviews";

type DetailsTab = "description" | "specs" | "reviews";

interface ProductDetailsTabsProps {
  productId: string;
  /** Server-rendered panels: they stay in the HTML even while their tab is not selected. */
  description: ReactNode;
  specs: ReactNode;
}

/**
 * Descripción / Especificaciones / Reseñas as tabs (arrow keys move between
 * tabs, the indicator slides). Every panel is kept mounted, so the server
 * HTML carries all the content. Visiting #resenas (or clicking a link to it)
 * selects the reviews tab.
 */
export function ProductDetailsTabs({ productId, description, specs }: ProductDetailsTabsProps) {
  const [tab, setTab] = useState<DetailsTab>("description");
  const reviewCount = useReviewStore((state) => state.reviews.filter((r) => r.productId === productId).length);

  useEffect(() => {
    const openFromHash = () => {
      if (decodeURIComponent(window.location.hash.slice(1)) !== REVIEWS_HASH) return;
      setTab("reviews");
      // Clear the fragment so the same link works again (hashchange only fires on a change).
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <section id={REVIEWS_HASH} aria-label="Detalles del producto" className="scroll-mt-24">
      <Tabs value={tab} onValueChange={(value) => setTab(value as DetailsTab)}>
        <TabsList aria-label="Detalles del producto">
          <TabsTrigger value="description">Descripción</TabsTrigger>
          <TabsTrigger value="specs">Especificaciones</TabsTrigger>
          <TabsTrigger value="reviews">
            Reseñas
            <span className="rounded-full bg-bg-muted px-2 py-0.5 text-caption font-semibold text-fg-secondary tabular-nums">
              {reviewCount}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="description" keepMounted className="pt-4">
          {description}
        </TabsContent>
        <TabsContent value="specs" keepMounted className="pt-4">
          {specs}
        </TabsContent>
        <TabsContent value="reviews" keepMounted className="pt-4">
          <ProductReviews productId={productId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
