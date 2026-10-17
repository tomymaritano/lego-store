import type { NextRequest } from "next/server";
import { getSearchSuggestions } from "@/lib/api";

const MAX_LIMIT = 10;

/**
 * GET /api/search?q=star wars&limit=5
 * Autocomplete rows ({ items, total }). Uses the same search as /search.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || 5));

  return Response.json(await getSearchSuggestions(q, limit));
}
