/** Reads VERCEL and TRUSTED_PROXY_HOPS. */
type IpEnv = Record<string, string | undefined>;

/**
 * The client's IP, for rate-limit keys. Only headers set by infrastructure we
 * trust count, never what the client sends:
 *
 * - On Vercel (VERCEL=1): X-Real-IP, then X-Vercel-Forwarded-For, then the
 *   first X-Forwarded-For entry. Vercel's edge overwrites all three.
 * - Behind your own proxies (TRUSTED_PROXY_HOPS=N, N >= 1): the X-Forwarded-For
 *   entry the outermost trusted proxy appended, N from the right. Entries to
 *   its left came from the client and are ignored.
 * - Otherwise (`next dev`, a bare `next start`): X-Forwarded-For is whatever
 *   the client sent (Next only fills it in when it is missing), so no IP is
 *   trusted and every client shares the "unknown" bucket. That errs on the
 *   strict side: per-IP limits then apply to the whole site at once, so a
 *   public self-hosted deploy must set TRUSTED_PROXY_HOPS (see README).
 *
 * Per-account limits (login by email, known devices) do not depend on this.
 */
export function clientIp(headers: Pick<Headers, "get">, env: IpEnv = process.env): string {
  const ip = env.VERCEL === "1" ? vercelIp(headers) : proxiedIp(headers, trustedProxyHops(env));
  return ip ? ip.slice(0, 64) : "unknown";
}

function list(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function vercelIp(headers: Pick<Headers, "get">): string | undefined {
  return list(headers.get("x-real-ip"))[0] ?? list(headers.get("x-vercel-forwarded-for"))[0] ?? list(headers.get("x-forwarded-for"))[0];
}

function proxiedIp(headers: Pick<Headers, "get">, hops: number): string | undefined {
  if (hops === 0) return undefined;
  const entries = list(headers.get("x-forwarded-for"));
  // Fewer entries than trusted proxies: the request did not come through them all.
  return entries.length >= hops ? entries[entries.length - hops] : undefined;
}

/** TRUSTED_PROXY_HOPS as a whole number from 0 to 10; anything else counts as 0 (trust none). */
export function trustedProxyHops(env: IpEnv = process.env): number {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return 0;
  return Math.min(Number(raw), 10);
}
