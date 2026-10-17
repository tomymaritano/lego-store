import { NextResponse, type NextRequest } from "next/server";
import { getCategoryById } from "@/lib/api";

/**
 * Unknown categories get a real 404. The category page reads its filters
 * from searchParams, so it renders on demand and streams behind loading.tsx:
 * by the time the page could call notFound() the 200 status has been sent.
 * Checking here, before rendering, keeps the status honest (the item page
 * does not need this: it is generated statically and its 404 is cached).
 */
export async function proxy(request: NextRequest) {
  const [, , rawId] = request.nextUrl.pathname.split("/");
  let id: string;
  try {
    id = decodeURIComponent(rawId ?? "");
  } catch {
    id = "";
  }
  if (id && (await getCategoryById(id))) return NextResponse.next();

  // No route matches this path, so Next renders the app's not-found page with a 404.
  const missing = request.nextUrl.clone();
  missing.pathname = "/category/not-found/__missing";
  missing.search = "";
  return NextResponse.rewrite(missing, { status: 404 });
}

export const config = {
  matcher: "/category/:categoryId",
};
