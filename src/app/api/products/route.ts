import type { NextRequest } from "next/server";
import { getPaginatedProducts } from "@/lib/api";
import { parseProductQuery } from "@/lib/productQuery";

/**
 * GET /api/products?q=&category=&theme=&sort=&page=&limit=…
 * One page of the catalogue (see parseProductQuery for every parameter).
 * Feeds infinite scroll and client-side filter changes.
 */
export async function GET(request: NextRequest) {
  const query = parseProductQuery(request.nextUrl.searchParams);
  return Response.json(await getPaginatedProducts(query));
}
