import { NextResponse, type NextRequest } from "next/server";
import { getCategoryById, getCategoryRedirect, getProductById } from "@/lib/api";
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
 * redirected, and this check never writes cookies (see requireSession).
 *
 * /category/<id> and /item/<id>: unknown ids get a real 404 before any
 * rendering (the not-found page would otherwise be rendered with a 200 by
 * the on-demand render). Keep these lookups cheap: they run on every request
 * to those pages. A category's old slug (an admin changed it) is a permanent
 * redirect to its current one, filters included.
 */

const PROTECTED = new Set(["account", "admin"]);

const exists: Record<string, (id: string) => Promise<unknown>> = {
  category: getCategoryById,
  item: getProductById,
};

/*
 * Read-only on purpose. Auth.js's wrapper re-issues the session cookie
 * (Set-Cookie) on every request it sees, including <Link> prefetches of
 * /account and /admin. A prefetch that left before logout and answered after
 * it would write the old token back and silently undo the logout (the same
 * race could overwrite the token a password change just renewed). So the
 * wrapper only decides, and proxy() answers with a fresh response that sets
 * no cookies. Consequence: the session is not slid forward here; it lasts
 * SESSION_MAX_AGE_SECONDS from login (or from the last renewal by a Server
 * Action, e.g. a password change).
 */
const SIGNED_IN = "x-proxy-signed-in";
const checkSession = auth((request) => new Response(null, { headers: { [SIGNED_IN]: request.auth?.user?.id ? "1" : "0" } }));

/** Auth.js's wrapper takes a route context; proxy has no route params. */
const NO_PARAMS = { params: Promise.resolve({}) };

async function requireSession(request: NextRequest): Promise<Response> {
  // A Server Action POST without a session reaches its own check, which answers in a way its caller understands.
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const decision = await checkSession(request, NO_PARAMS);
  if (decision?.headers.get(SIGNED_IN) === "1") return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(loginHref(`${pathname}${search}`), request.nextUrl));
}

export async function proxy(request: NextRequest): Promise<Response> {
  const [, section = "", rawId] = request.nextUrl.pathname.split("/");
  if (PROTECTED.has(section)) return requireSession(request);

  let id: string;
  try {
    id = decodeURIComponent(rawId ?? "");
  } catch {
    id = "";
  }
  const lookup = exists[section];
  if (id && lookup && (await lookup(id))) return NextResponse.next();

  const moved = section === "category" && id ? await getCategoryRedirect(id) : null;
  if (moved) {
    const target = request.nextUrl.clone();
    target.pathname = `/category/${encodeURIComponent(moved)}`;
    return NextResponse.redirect(target, 308);
  }

  // No route matches this path, so Next renders the app's not-found page with a 404.
  const missing = request.nextUrl.clone();
  missing.pathname = `/${section}/not-found/__missing`;
  missing.search = "";
  return NextResponse.rewrite(missing, { status: 404 });
}

export const config = {
  matcher: ["/category/:categoryId", "/item/:productId", "/account/:path*", "/admin/:path*"],
};
