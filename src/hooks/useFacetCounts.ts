"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchFacetCounts } from "@/lib/api-client";
import { serializeProductQuery } from "@/lib/productQuery";
import type { FacetCounts, ProductQuery } from "@/types";

interface UseFacetCountsOptions {
  /** The query whose filters the counts follow (search text, scope, filters). */
  query: ProductQuery;
  /** Counts the server rendered (getFacetCounts) for `initialQuery`. */
  initialCounts: FacetCounts;
  initialQuery: ProductQuery;
}

/** Only filters change the counts: sort and paging do not. */
const keyOf = (query: ProductQuery) =>
  serializeProductQuery({
    ...query,
    sort: undefined,
    page: undefined,
    limit: undefined,
  }).toString();

/**
 * Facet counts for the current filters from GET /api/products/facets. The
 * server-rendered counts seed the cache; while a new query loads, the
 * previous numbers stay on screen.
 */
export function useFacetCounts({ query, initialCounts, initialQuery }: UseFacetCountsOptions): FacetCounts {
  const key = keyOf(query);
  const isInitial = key === keyOf(initialQuery);

  const result = useQuery({
    queryKey: ["products", "facets", key],
    queryFn: ({ signal }) => fetchFacetCounts(query, signal),
    initialData: isInitial ? initialCounts : undefined,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });

  return result.data ?? initialCounts;
}
