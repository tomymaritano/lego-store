import type { PrismaClient } from "@/generated/prisma/client";
import type { RateLimitStore } from "./limiter";

/*
 * Rate-limit counters in the RateLimit table: one row per key, updated with a
 * single INSERT … ON CONFLICT statement, so concurrent hits on the same key
 * (several server instances, parallel requests) each get their own count and
 * none is lost. Windows run on the database clock, never the servers' clocks.
 *
 * "resetAt" is a timestamp without time zone holding UTC (Prisma's
 * convention), hence `now() AT TIME ZONE 'UTC'`.
 *
 * Rows are tiny and reused by their key's next hit; about one hit in
 * SWEEP_EVERY also deletes windows that ended over an hour ago.
 */

const SWEEP_EVERY = 200;

export function postgresStore(db: () => PrismaClient, random: () => number = Math.random): RateLimitStore {
  return {
    async hit(key, windowMs) {
      const seconds = windowMs / 1000;
      const [row] = await db().$queryRaw<{ count: number; resetAt: Date }[]>`
        INSERT INTO "RateLimit" ("key", "count", "resetAt")
        VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${seconds}))
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "RateLimit"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimit"."count" + 1 END,
          "resetAt" = CASE WHEN "RateLimit"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
        RETURNING "count", "resetAt"
      `;
      if (random() < 1 / SWEEP_EVERY) {
        // Best effort: a failed sweep never fails the request.
        await db()
          .$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < (now() AT TIME ZONE 'UTC') - interval '1 hour'`
          .catch(() => {});
      }
      return { count: Number(row!.count), resetAt: new Date(row!.resetAt) };
    },
    async reset(key) {
      await db().$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ${key}`;
    },
  };
}
