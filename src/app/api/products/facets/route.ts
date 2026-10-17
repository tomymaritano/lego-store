import type { NextRequest } from "next/server";
import { getFacetCounts } from "@/lib/api";
import { readProductQuery } from "@/lib/api/queryInput";

/**
 * GET /api/products/facets?q=&category=&theme=…
 * Filter counts that follow the active filters (see getFacetCounts). The
 * catalogue filters refresh their numbers with it after every change.
 */
export async function GET(request: NextRequest) {
  const query = readProductQuery(request.nextUrl.searchParams);
  if (!query) return Response.json({ error: "Parámetros de búsqueda inválidos" }, { status: 400 });
  return Response.json(await getFacetCounts(query));
}
