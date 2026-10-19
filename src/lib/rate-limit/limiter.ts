/*
 * Fixed-window rate limiting with a pluggable store.
 *
 *   const limiter = createRateLimiter({ name: "register-ip", limit: 5, windowMs: HOUR, store });
 *   const result = await limiter.consume(ip);
 *   if (!result.ok) return tooManyAttempts(result.retryAfterSeconds);
 *
 * A window opens on the first hit of a key and lasts `windowMs`; every hit in
 * it counts, and the hit that goes over `limit` (and every one after it, until
 * the window ends) is refused. Fixed windows allow up to 2 × limit across a
 * window boundary, which is fine for slowing down guessing and spam: they are
 * a brake, not a quota.
 *
 * The app's store is Postgres (./postgres.ts): one counter per key shared by
 * every server instance, so it holds on serverless too. memoryStore() is for
 * tests and scripts: it lives in one process and forgets on restart, so on
 * serverless each instance would count on its own.
 */

export interface RateLimitHit {
  /** Hits in the current window, this one included. */
  count: number;
  /** When the current window ends. */
  resetAt: Date;
}

export interface RateLimitStore {
  /** Atomically counts one hit for `key`, opening a new window of `windowMs` if the last one ended. */
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
  /** Forgets `key` (e.g. a successful login clears its failed attempts). */
  reset(key: string): Promise<void>;
}

export interface RateLimitResult {
  ok: boolean;
  /** Hits left in this window (0 once refused). */
  remaining: number;
  /** Seconds until the window ends (at least 1). */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Prefix of the stored keys; one per limiter ("login-email", "register-ip"…). */
  name: string;
  /** Hits allowed per window. */
  limit: number;
  windowMs: number;
  store: RateLimitStore;
  /** Clock used for retryAfterSeconds (tests). */
  now?: () => number;
}

export interface RateLimiter {
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
  /** Counts one hit for `subject` and says whether it is allowed. */
  consume(subject: string): Promise<RateLimitResult>;
  /** Clears `subject`'s window. */
  reset(subject: string): Promise<void>;
}

/** Longest subject kept in a key: anything longer is a client sending junk. */
const MAX_SUBJECT_LENGTH = 200;

export function createRateLimiter({ name, limit, windowMs, store, now = Date.now }: RateLimiterOptions): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`Rate limiter "${name}": limit must be a positive integer.`);
  if (!(windowMs > 0)) throw new Error(`Rate limiter "${name}": windowMs must be positive.`);
  const keyOf = (subject: string) => `${name}:${subject.slice(0, MAX_SUBJECT_LENGTH)}`;

  return {
    name,
    limit,
    windowMs,
    async consume(subject) {
      const { count, resetAt } = await store.hit(keyOf(subject), windowMs);
      return {
        ok: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now()) / 1000)),
      };
    },
    reset(subject) {
      return store.reset(keyOf(subject));
    },
  };
}

/** In-process store: tests, scripts, a single long-lived server. Not shared between instances. */
export function memoryStore(now: () => number = Date.now): RateLimitStore & { size(): number } {
  const windows = new Map<string, RateLimitHit>();
  return {
    async hit(key, windowMs) {
      const current = windows.get(key);
      const time = now();
      if (!current || current.resetAt.getTime() <= time) {
        const fresh = { count: 1, resetAt: new Date(time + windowMs) };
        windows.set(key, fresh);
        // Drop ended windows now and then so the map cannot grow without bound.
        if (windows.size > 10_000) {
          for (const [k, w] of windows) if (w.resetAt.getTime() <= time) windows.delete(k);
        }
        return { ...fresh };
      }
      current.count += 1;
      return { ...current };
    },
    async reset(key) {
      windows.delete(key);
    },
    size: () => windows.size,
  };
}

/** "8 minutos", "1 minuto": how long to wait, rounded up to whole minutes. */
export function waitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}
