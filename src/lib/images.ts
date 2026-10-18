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
 * - an https URL matching one of REMOTE_IMAGE_PATTERNS: the lego.com CDN of
 *   the seed's pictures, and Vercel Blob, where the admin's uploads live in
 *   production (src/lib/uploads; in dev they are site files under /uploads/).
 *
 * Keep REMOTE_IMAGE_PATTERNS equal to next.config.mjs's remotePatterns, and
 * the site-file rule in step with its (absent) localPatterns
 * (__tests__/lib/images.test.ts checks both). Client-safe.
 */

export interface RemoteImagePattern {
  protocol: "https";
  /** An exact host, or "*.<domain>": exactly one label before the domain (as next/image reads it). */
  hostname: string;
  /** "/cdn/**": a path prefix followed by anything. */
  pathname: string;
}

/** Vercel Blob's public stores: "<store id>.public.blob.vercel-storage.com". */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export const REMOTE_IMAGE_PATTERNS: readonly RemoteImagePattern[] = [
  { protocol: "https", hostname: "www.lego.com", pathname: "/cdn/**" },
  { protocol: "https", hostname: `*${BLOB_HOST_SUFFIX}`, pathname: "/**" },
];

/** Hosts an admin may paste a picture from, for messages ("www.lego.com"); uploads are said apart. */
export const REMOTE_IMAGE_HOSTS = REMOTE_IMAGE_PATTERNS.filter((pattern) => !pattern.hostname.startsWith("*")).map((pattern) => pattern.hostname);

function hostMatches(hostname: string, pattern: string): boolean {
  if (!pattern.startsWith("*.")) return hostname === pattern;
  const suffix = pattern.slice(1);
  const label = hostname.slice(0, -suffix.length);
  return hostname.endsWith(suffix) && /^[a-z0-9-]+$/.test(label);
}

function matchesPattern(url: URL, pattern: RemoteImagePattern): boolean {
  if (url.protocol !== `${pattern.protocol}:` || !hostMatches(url.hostname, pattern.hostname) || url.port !== "") return false;
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
