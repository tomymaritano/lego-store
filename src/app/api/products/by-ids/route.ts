import type { NextRequest } from "next/server";
import { getProductsByIds } from "@/lib/api";

/**
 * GET /api/products/by-ids?ids=1,2,3 (or ?ids=1&ids=2)
 * Products in the order requested; unknown ids are skipped. Hydrates the
 * id lists the client persists (compare, wishlist, recently viewed).
 */
export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams
    .getAll("ids")
    .flatMap((value) => value.split(","))
    .map((id) => id.trim())
    .filter(Boolean);

  return Response.json({ items: await getProductsByIds(ids) });
}
