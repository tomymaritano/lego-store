import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { createRateLimiter } from "@/lib/rate-limit/limiter";
import { postgresStore } from "@/lib/rate-limit/postgres";
import { testDb } from "./setup/db";

/** The Postgres rate-limit store (src/lib/rate-limit/postgres.ts) on the test database. */

beforeEach(async () => {
  await testDb.rateLimit.deleteMany();
});

describe("postgresStore", () => {
  it("counts hits in one window and reports when it ends (database clock)", async () => {
    const store = postgresStore(getDb);
    const before = Date.now();
    const first = await store.hit("t:a", 60_000);
    const second = await store.hit("t:a", 60_000);
    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(second.resetAt.getTime()).toBe(first.resetAt.getTime());
    // Close to now + 60 s: the local database and this process share a clock.
    expect(Math.abs(first.resetAt.getTime() - (before + 60_000))).toBeLessThan(5_000);
  });

  it("gives every concurrent hit its own count (nothing lost under contention)", async () => {
    const store = postgresStore(getDb);
    const counts = await Promise.all(Array.from({ length: 25 }, () => store.hit("t:burst", 60_000).then((h) => h.count)));
    expect(counts.sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("starts a new window after the old one ends", async () => {
    const store = postgresStore(getDb);
    await store.hit("t:old", 60_000);
    await store.hit("t:old", 60_000);
    await testDb.rateLimit.update({ where: { key: "t:old" }, data: { resetAt: new Date(Date.now() - 1_000) } });
    const hit = await store.hit("t:old", 60_000);
    expect(hit.count).toBe(1);
    expect(hit.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("reset() forgets a key; the sweep removes windows that ended over an hour ago", async () => {
    const sweeping = postgresStore(getDb, () => 0); // sweeps on every hit
    await sweeping.hit("t:a", 60_000);
    await sweeping.reset("t:a");
    expect(await testDb.rateLimit.count({ where: { key: "t:a" } })).toBe(0);

    await testDb.rateLimit.create({ data: { key: "t:stale", count: 3, resetAt: new Date(Date.now() - 2 * 3_600_000) } });
    await testDb.rateLimit.create({ data: { key: "t:recent", count: 3, resetAt: new Date(Date.now() - 60_000) } });
    await sweeping.hit("t:b", 60_000);
    expect((await testDb.rateLimit.findMany({ orderBy: { key: "asc" } })).map((r) => r.key)).toEqual(["t:b", "t:recent"]);
  });

  it("drives a limiter end to end", async () => {
    const limiter = createRateLimiter({ name: "it", limit: 2, windowMs: 60_000, store: postgresStore(getDb) });
    expect((await limiter.consume("x")).ok).toBe(true);
    expect((await limiter.consume("x")).ok).toBe(true);
    const refused = await limiter.consume("x");
    expect(refused.ok).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(50);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(65);
  });
});
