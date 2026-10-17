"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { transitions } from "@/lib/motion";
import { fetchProductsPage } from "@/lib/api-client";
import { serializeProductQuery } from "@/lib/productQuery";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { Button, EmptyState, Spinner } from "@/components/ui";
import type { PaginatedResponse, Product, ProductQuery } from "@/types";
import { ProductCard } from "./ProductCard";
import { QuickViewModal } from "./QuickViewModal";

interface ProductListProps {
  /** First page, rendered on the server (getPaginatedProducts). */
  initialPage: PaginatedResponse<Product>;
  /** The query that produced it; later pages are fetched from /api/products. */
  query?: ProductQuery;
  columns?: 3 | 4;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Cards of the first page above the fold load their image eagerly. */
const EAGER_IMAGES = 4;
/** Cap the entrance stagger so a long page still lands within the motion budget. */
const STAGGER = 0.04;
const MAX_STAGGER = 0.24;

/**
 * Product grid with infinite scroll. The server renders page 1; the client
 * asks GET /api/products for the next pages as the sentinel nears the
 * viewport (with a "Cargar más" button as a fallback). Only the cards on
 * screen ever reach the browser, never the whole catalogue.
 */
export function ProductList({
  initialPage,
  query = {},
  columns = 4,
  emptyTitle = "No se encontraron productos",
  emptyDescription = "Intenta ajustar los filtros o buscar algo diferente. Tenemos muchos sets increíbles esperándote.",
}: ProductListProps) {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const baseQuery = { ...query, page: undefined, limit: initialPage.limit };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery({
    queryKey: ["products", "list", serializeProductQuery(baseQuery).toString()],
    queryFn: ({ pageParam, signal }) => fetchProductsPage({ ...baseQuery, page: pageParam }, signal),
    initialPageParam: initialPage.page,
    initialData: { pages: [initialPage], pageParams: [initialPage.page] },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: Infinity,
  });

  const pages = data.pages;
  const total = pages[0]?.total ?? 0;
  const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => void fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage && !isFetchNextPageError,
  });

  if (total === 0) {
    return <EmptyState icon={<Package />} title={emptyTitle} description={emptyDescription} />;
  }

  const gridCols =
    columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <>
      <ul className={`grid ${gridCols} gap-4 md:gap-6`} aria-label={`${total} productos`}>
        {pages.map((page, pageIndex) =>
          page.items.map((product, index) => (
            <motion.li
              key={product.id}
              // Each page staggers in on its own, so appended rows animate too.
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { ...transitions.slow, delay: Math.min(index * STAGGER, MAX_STAGGER) } }}
              className="h-full"
            >
              <ProductCard
                product={product}
                onQuickView={setQuickViewProduct}
                priority={pageIndex === 0 && index < EAGER_IMAGES}
              />
            </motion.li>
          ))
        )}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-4" aria-live="polite">
        <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

        {isFetchingNextPage ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Spinner className="size-5" />
            Cargando más productos…
          </p>
        ) : hasNextPage ? (
          <Button variant="outline" onClick={() => void fetchNextPage()}>
            {isFetchNextPageError ? "Reintentar" : "Cargar más productos"}
          </Button>
        ) : (
          <p className="text-sm text-fg-muted">
            {loaded === 1 ? "Este es el único producto" : `Has visto los ${loaded} productos`}
          </p>
        )}
      </div>

      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  );
}
