/*
 * Which picture URLs a product may use. The storefront renders them with
 * next/image, which refuses (and breaks the page for) any remote host that
 * next.config.mjs does not list in images.remotePatterns, so the admin form
 * only accepts what that config allows:
 *
 * - a file of the site itself: "/images/lego.png" (public/), with no query
 *   string or fragment: next.config.mjs sets no images.localPatterns, and
 *   Next's default ({ pathname: "**", search: "" }) makes next/image throw
 *   during render on "/images/lego.png?v=2";
 * - an https URL matching one of REMOTE_IMAGE_PATTERNS.
 *
 * Keep REMOTE_IMAGE_PATTERNS equal to next.config.mjs's remotePatterns, and
 * the site-file rule in step with its (absent) localPatterns
 * (__tests__/lib/images.test.ts checks both). Client-safe.
 */

export interface RemoteImagePattern {
  protocol: "https";
  hostname: string;
  /** "/cdn/**": a path prefix followed by anything. */
  pathname: string;
}

export const REMOTE_IMAGE_PATTERNS: readonly RemoteImagePattern[] = [
  { protocol: "https", hostname: "www.lego.com", pathname: "/cdn/**" },
];

/** Hosts a product picture may come from, for messages ("www.lego.com"). */
export const REMOTE_IMAGE_HOSTS = REMOTE_IMAGE_PATTERNS.map((pattern) => pattern.hostname);

function matchesPattern(url: URL, pattern: RemoteImagePattern): boolean {
  if (url.protocol !== `${pattern.protocol}:` || url.hostname !== pattern.hostname || url.port !== "") return false;
  const prefix = pattern.pathname.replace(/\*\*$/, "");
  return url.pathname.startsWith(prefix) && url.pathname.length > prefix.length;
}

/** Whether next/image can render `value` as a product picture. */
export function isAllowedImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048 || /\s/.test(trimmed)) return false;
  // A file of this site: one leading slash (not "//host", not "/\host"), no "..", no query string or fragment.
  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//") && !/[\\?#]/.test(trimmed) && !trimmed.split("/").includes("..");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  return REMOTE_IMAGE_PATTERNS.some((pattern) => matchesPattern(url, pattern));
}
