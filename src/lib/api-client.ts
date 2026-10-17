import { serializeProductQuery } from "@/lib/productQuery";
import type { PaginatedResponse, Product, ProductQuery, SearchSuggestion } from "@/types";

/**
 * Browser-side calls to the Route Handlers in src/app/api. Client islands use
 * these (usually through React Query); Server Components call @/lib/api.
 */

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`GET ${url} → ${response.status}`);
  return response.json() as Promise<T>;
}

export function fetchProductsPage(query: ProductQuery, signal?: AbortSignal) {
  return getJson<PaginatedResponse<Product>>(`/api/products?${serializeProductQuery(query)}`, signal);
}

export function fetchSearchSuggestions(q: string, limit = 5, signal?: AbortSignal) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return getJson<{ items: SearchSuggestion[]; total: number }>(`/api/search?${params}`, signal);
}

export async function fetchProductsByIds(ids: string[], signal?: AbortSignal): Promise<Product[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.join(",") });
  return (await getJson<{ items: Product[] }>(`/api/products/by-ids?${params}`, signal)).items;
}
