"use client";

import { Package } from "lucide-react";
import { useProductPages } from "@/hooks/useProductPages";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { pluralize } from "@/lib/utils";
import { Button, EmptyState, Spinner } from "@/components/ui";
import type { PaginatedResponse, Product, ProductQuery } from "@/types";
import { ProductGrid, type ProductGridProps } from "./ProductGrid";

/** Cards of the first page above the fold load their image eagerly. */
const EAGER_IMAGES = 4;

interface ProductListProps extends Pick<ProductGridProps, "columns" | "reveal"> {
  /** First page, rendered on the server (getPaginatedProducts). */
  initialPage: PaginatedResponse<Product>;
  /** The query to show; later pages (and other queries) come from /api/products. */
  query?: ProductQuery;
  /** The query `initialPage` answers, when `query` can change on the client. */
  initialQuery?: ProductQuery;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Product grid with infinite scroll. The server renders page 1; the client
 * asks GET /api/products for the next pages as the sentinel nears the
 * viewport (with a "Cargar más" button as a fallback). Only the cards on
 * screen ever reach the browser, never the whole catalogue.
 */
export function ProductList({
  initialPage,
  query = {},
  initialQuery,
  columns = 4,
  reveal = "mount",
  emptyTitle = "No se encontraron productos",
  emptyDescription = "Intenta ajustar los filtros o buscar algo diferente. Tenemos muchos sets increíbles esperándote.",
}: ProductListProps) {
  const pages = useProductPages({ query, initialPage, initialQuery });

  if (pages.total === 0 && !pages.isStale) {
    return <EmptyState icon={<Package />} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <ProductGrid
        products={pages.products}
        reveal={reveal}
        batchSize={pages.pageSize}
        eagerCount={reveal === "mount" ? EAGER_IMAGES : 0}
        columns={columns}
        busy={pages.isStale}
        label={pluralize(pages.total, "producto")}
      />
      <LoadMore {...pages} />
    </>
  );
}

type LoadMoreProps = Pick<
  ReturnType<typeof useProductPages>,
  "products" | "hasNextPage" | "fetchNextPage" | "isFetchingNextPage" | "isFetchNextPageError" | "isStale"
>;

/** Infinite-scroll sentinel, "Cargar más" fallback and the end-of-list note. */
export function LoadMore({ products, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError, isStale }: LoadMoreProps) {
  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => void fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage && !isFetchNextPageError,
  });
  const loaded = products.length;

  return (
    <div className="mt-10 flex flex-col items-center gap-4" aria-live="polite">
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {isStale ? null : isFetchingNextPage ? (
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
  );
}
