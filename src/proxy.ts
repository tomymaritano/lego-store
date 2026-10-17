import { NextResponse, type NextRequest } from "next/server";
import { getCategoryById, getProductById } from "@/lib/api";
import { auth } from "@/lib/auth";
import { loginHref } from "@/lib/auth/callback-url";

/*
 * Two jobs, by path:
 *
 * /account/* and /admin/*: a visitor without a session goes to /login (and
 * back here afterwards) before anything renders. This is only the early,
 * optimistic check: it reads the session cookie, not the database. Every
 * protected page, Server Action and Route Handler checks again on the server
 * (src/lib/auth/session.ts), including the admin role, so a route this
 * matcher misses is still protected. Only page loads (GET/HEAD) are
 * redirected: a Server Action POST without a session reaches its own check,
 * which answers in a way the action's caller understands.
 *
 * /category/<id> and /item/<id>: unknown ids get a real 404 before any
 * rendering (the not-found page would otherwise be rendered with a 200 by
 * the on-demand render). Keep these lookups cheap: they run on every request
 * to those pages.
 */

const PROTECTED = new Set(["account", "admin"]);

const exists: Record<string, (id: string) => Promise<unknown>> = {
  category: getCategoryById,
  item: getProductById,
};

const requireSession = auth((request) => {
  if (request.auth?.user?.id || !["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(loginHref(`${pathname}${search}`), request.nextUrl));
});

/** Auth.js's wrapper takes a route context; proxy has no route params. */
const NO_PARAMS = { params: Promise.resolve({}) };

export async function proxy(request: NextRequest): Promise<Response> {
  const [, section = "", rawId] = request.nextUrl.pathname.split("/");
  if (PROTECTED.has(section)) return (await requireSession(request, NO_PARAMS)) ?? NextResponse.next();

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
  matcher: ["/category/:categoryId", "/item/:productId", "/account/:path*", "/admin/:path*"],
};
