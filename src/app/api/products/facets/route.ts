import type { NextRequest } from "next/server";
import { getFacetCounts } from "@/lib/api";
import { parseProductQuery } from "@/lib/productQuery";

/**
 * GET /api/products/facets?q=&category=&theme=…
 * Filter counts that follow the active filters (see getFacetCounts). The
 * catalogue filters refresh their numbers with it after every change.
 */
export async function GET(request: NextRequest) {
  const query = parseProductQuery(request.nextUrl.searchParams);
  return Response.json(await getFacetCounts(query));
}
