import type { NextRequest } from "next/server";
import * as z from "zod";
import { getSearchSuggestions } from "@/lib/api";
import { cleanSearchText } from "@/lib/productQuery";

const MAX_LIMIT = 10;

/** q is cleaned and capped like the catalogue's (see cleanSearchText); a bad limit falls back to 5. */
const searchParamsSchema = z.object({
  q: z.string().transform(cleanSearchText),
  limit: z.coerce.number().int().min(1).catch(5).transform((n) => Math.min(MAX_LIMIT, n)),
});

/**
 * GET /api/search?q=star wars&limit=5
 * Autocomplete rows ({ items, total }). Uses the same search as /search.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { q, limit } = searchParamsSchema.parse({ q: params.get("q") ?? "", limit: params.get("limit") ?? undefined });

  return Response.json(await getSearchSuggestions(q, limit));
}
