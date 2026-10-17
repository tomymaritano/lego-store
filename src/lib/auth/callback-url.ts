/*
 * Where to send someone after login/registration: the `callbackUrl` query
 * parameter, but only when it is a path on this site. Anything else (another
 * origin, a protocol-relative "//evil.com", "/\evil.com" that browsers read as
 * a host, javascript: URLs, control characters) falls back to the home page,
 * so a crafted login link can never bounce a user to another site.
 *
 * Pure and dependency-free: used by the login/register pages, their Server
 * Actions, proxy.ts and the navbar's login link.
 */

/** Pages that make no sense to return to after signing in (they would loop). */
const AUTH_PAGES = ["/login", "/register"];

/** Longest callback kept; longer ones are junk. */
const MAX_LENGTH = 2048;

const BASE = "http://callback.invalid";

export function safeCallbackUrl(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return fallback;
  // Only site-relative paths: "/x", never "//x" or "/\x" (both name a host).
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  // Control characters and whitespace (browsers strip some of them, turning "/\t/evil.com" into "//evil.com").
  if (/[\u0000- \u007f]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  if (AUTH_PAGES.some((page) => url.pathname === page || url.pathname.startsWith(`${page}/`))) return fallback;
  if (url.pathname.startsWith("/api/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** "/login?callbackUrl=…" for `path` (the home page needs no callback). */
export function loginHref(path: string, page: "/login" | "/register" = "/login"): string {
  const callback = safeCallbackUrl(path, "");
  return callback && callback !== "/" ? `${page}?${new URLSearchParams({ callbackUrl: callback })}` : page;
}
