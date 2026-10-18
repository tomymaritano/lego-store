import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authorizeRequest } from "@/lib/auth/session";
import { getViewerReviews } from "@/lib/api/reviews";
import { productIdSchema } from "@/lib/validations/lists";
import type { ViewerReviews } from "@/types";

/**
 * GET /api/products/<id>/reviews/mine
 * The signed-in user's own review of the product (or null) and the ids of its
 * reviews they marked "útil". 401 without a session. Per user: never cached.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const auth = await authorizeRequest();
  if ("response" in auth) return auth.response;
  const parsed = productIdSchema.safeParse((await params).productId);
  const body: ViewerReviews = parsed.success
    ? await getViewerReviews(getDb(), auth.user.id, parsed.data)
    : { review: null, helpful: [] };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
