import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authorizeRequest } from "@/lib/auth/session";
import { getCart } from "@/lib/lists/cart";
import { getWishlist } from "@/lib/lists/wishlist";
import type { ServerLists } from "@/lib/lists/types";

/**
 * GET /api/lists: the signed-in user's cart and wishlist with current product
 * data (401 without a session). Per user, so never cached.
 */
export async function GET() {
  const auth = await authorizeRequest();
  if ("response" in auth) return auth.response;
  const db = getDb();
  const [cart, wishlist] = await Promise.all([getCart(db, auth.user.id), getWishlist(db, auth.user.id)]);
  return NextResponse.json({ cart, wishlist } satisfies ServerLists, { headers: { "Cache-Control": "private, no-store" } });
}
