import type { NextRequest } from "next/server";
import { getPaginatedProducts } from "@/lib/api";
import { readProductQuery } from "@/lib/api/queryInput";

/**
 * GET /api/products?q=&category=&theme=&sort=&page=&limit=…
 * One page of the catalogue (see parseProductQuery for every parameter; validated by readProductQuery).
 * Feeds infinite scroll and client-side filter changes.
 */
export async function GET(request: NextRequest) {
  const query = readProductQuery(request.nextUrl.searchParams);
  if (!query) return Response.json({ error: "Parámetros de búsqueda inválidos" }, { status: 400 });
  return Response.json(await getPaginatedProducts(query));
}
