/**
 * The client's IP, for rate-limit keys: the first X-Forwarded-For entry (set
 * by Vercel and by Next's own server), then X-Real-IP, else "unknown" (every
 * such client then shares one bucket, which errs on the strict side).
 *
 * Behind no proxy at all, X-Forwarded-For is whatever the client sends, so a
 * self-hosted deploy must sit behind a proxy that overwrites it. Per-account
 * limits (login by email) do not depend on it.
 */
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : "unknown";
}
