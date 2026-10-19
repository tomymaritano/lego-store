import type { NextRequest } from "next/server";
import { getReviewPage } from "@/lib/api";
import { parseReviewPage, parseReviewSort } from "@/lib/reviews/sorts";

/**
 * GET /api/products/<id>/reviews?sort=helpful&page=2
 * One page of the product's reviews in that order, plus the summary (average
 * and histogram). Unknown sorts and pages fall back to the defaults; an
 * unknown product is a 404. Served from the data cache, refreshed by every
 * review write.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const query = request.nextUrl.searchParams;
  const page = await getReviewPage(productId, parseReviewSort(query.get("sort")), parseReviewPage(query.get("page")));
  if (!page) return Response.json({ error: "Producto no encontrado." }, { status: 404 });
  return Response.json(page);
}
