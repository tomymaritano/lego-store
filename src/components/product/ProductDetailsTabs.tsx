"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReviewStore } from "@/stores/reviewStore";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { REVIEWS_HASH, WRITE_REVIEW_HASH } from "./anchors";
import type { ReviewsFocusRequest } from "./ProductReviews";

// Reviews live in a closed tab and come from the client-side review store, so
// they load after hydration: their sort menu (Base UI Select + floating UI)
// and list stay out of the product page's first-load JS.
const ProductReviews = dynamic(() => import("./ProductReviews").then((mod) => mod.ProductReviews), {
  ssr: false,
  loading: () => <Skeleton className="h-64 rounded-2xl" />,
});

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
 * selects the reviews tab and focuses its heading; #escribir-resena also opens
 * the review form and focuses its first field.
 */
export function ProductDetailsTabs({ productId, description, specs }: ProductDetailsTabsProps) {
  const [tab, setTab] = useState<DetailsTab>("description");
  const [focusRequest, setFocusRequest] = useState<ReviewsFocusRequest | null>(null);
  const reviewCount = useReviewStore((state) => state.reviews.filter((r) => r.productId === productId).length);

  useEffect(() => {
    const openFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash !== REVIEWS_HASH && hash !== WRITE_REVIEW_HASH) return;
      setTab("reviews");
      // A new object each time, so following the same link twice moves focus again.
      setFocusRequest({ target: hash === WRITE_REVIEW_HASH ? "form" : "heading" });
      // Clear the fragment so the same link works again (hashchange only fires on a change).
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <section id={REVIEWS_HASH} aria-label="Detalles del producto">
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
          <ProductReviews productId={productId} focusRequest={focusRequest} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
