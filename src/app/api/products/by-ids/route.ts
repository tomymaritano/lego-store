import type { NextRequest } from "next/server";
import { getProductsByIds } from "@/lib/api";
import { productIdListSchema } from "@/lib/validations/ids";

/**
 * GET /api/products/by-ids?ids=1,2,3 (or ?ids=1&ids=2)
 * Products in the order requested; unknown ids are skipped. Hydrates the
 * id lists the client persists (compare, wishlist, recently viewed).
 * 400 when an id is malformed (empty entries are ignored) or there are too many.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams
    .getAll("ids")
    .flatMap((value) => value.split(","))
    .filter((id) => id.trim() !== "");
  const ids = productIdListSchema.safeParse(raw);
  if (!ids.success) return Response.json({ error: "Ids de producto inválidos" }, { status: 400 });

  return Response.json({ items: await getProductsByIds(ids.data) });
}
