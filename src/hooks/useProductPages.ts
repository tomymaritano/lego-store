"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { fetchProductsPage } from "@/lib/api-client";
import { serializeProductQuery } from "@/lib/productQuery";
import type { PaginatedResponse, Product, ProductQuery } from "@/types";

interface UseProductPagesOptions {
  /** The query to show. Paging fields are ignored (pages are loaded on demand). */
  query: ProductQuery;
  /** First page rendered on the server (getPaginatedProducts). */
  initialPage: PaginatedResponse<Product>;
  /** The query `initialPage` answers; defaults to `query`. */
  initialQuery?: ProductQuery;
}

const keyOf = (query: ProductQuery) => serializeProductQuery({ ...query, page: undefined }).toString();

/**
 * Infinite pages of GET /api/products for a query. The server-rendered first
 * page seeds the cache, so nothing is fetched on load. When the query
 * changes (filters, sort) the previous results stay on screen, flagged as
 * `isStale`, until the new first page arrives.
 */
export function useProductPages({ query, initialPage, initialQuery = query }: UseProductPagesOptions) {
  const baseQuery: ProductQuery = { ...query, page: undefined, limit: initialPage.limit };
  const key = keyOf(baseQuery);
  const isInitial = key === keyOf({ ...initialQuery, limit: initialPage.limit });

  const result = useInfiniteQuery({
    queryKey: ["products", "list", key],
    queryFn: ({ pageParam, signal }) => fetchProductsPage({ ...baseQuery, page: pageParam }, signal),
    initialPageParam: 1,
    initialData: isInitial ? { pages: [initialPage], pageParams: [initialPage.page] } : undefined,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });

  const pages = result.data?.pages ?? [initialPage];
  return {
    pages,
    products: pages.flatMap((page) => page.items),
    total: pages[0]?.total ?? 0,
    pageSize: initialPage.limit,
    /** Showing the previous query's results while the new ones load. */
    isStale: result.isPlaceholderData,
    isError: result.isError && !result.data,
    refetch: result.refetch,
    hasNextPage: result.hasNextPage && !result.isPlaceholderData,
    fetchNextPage: result.fetchNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    isFetchNextPageError: result.isFetchNextPageError,
  };
}
