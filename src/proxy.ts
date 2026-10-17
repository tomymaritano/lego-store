import { NextResponse, type NextRequest } from "next/server";
import { getCategoryById, getProductById } from "@/lib/api";

/**
 * Unknown categories and products get a real 404. Both pages stream behind a
 * loading.tsx, so by the time the page itself could call notFound() the 200
 * status has already been sent (the not-found UI still renders, but crawlers
 * and link checkers see a 200). Checking here, before rendering, keeps the
 * status honest. Keep these lookups cheap: they run on every request to
 * /category/* and /item/*.
 */
const exists: Record<string, (id: string) => Promise<unknown>> = {
  category: getCategoryById,
  item: getProductById,
};

export async function proxy(request: NextRequest) {
  const [, section = "", rawId] = request.nextUrl.pathname.split("/");
  let id: string;
  try {
    id = decodeURIComponent(rawId ?? "");
  } catch {
    id = "";
  }
  const lookup = exists[section];
  if (id && lookup && (await lookup(id))) return NextResponse.next();

  // No route matches this path, so Next renders the app's not-found page with a 404.
  const missing = request.nextUrl.clone();
  missing.pathname = `/${section}/not-found/__missing`;
  missing.search = "";
  return NextResponse.rewrite(missing, { status: 404 });
}

export const config = {
  matcher: ["/category/:categoryId", "/item/:productId"],
};
