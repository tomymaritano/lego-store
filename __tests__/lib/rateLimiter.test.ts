import { describe, expect, it } from "vitest";
import { createRateLimiter, memoryStore, waitMessage } from "@/lib/rate-limit/limiter";
import { clientIp } from "@/lib/rate-limit/client-ip";

function setup(limit = 3, windowMs = 60_000) {
  let now = 1_000_000;
  const clock = () => now;
  const store = memoryStore(clock);
  const limiter = createRateLimiter({ name: "test", limit, windowMs, store, now: clock });
  return { limiter, store, advance: (ms: number) => (now += ms) };
}

describe("createRateLimiter (fixed window)", () => {
  it("allows `limit` hits per window, then refuses with the time left", async () => {
    const { limiter, advance } = setup(3, 60_000);
    expect(await limiter.consume("ana")).toEqual({ ok: true, remaining: 2, retryAfterSeconds: 60 });
    expect((await limiter.consume("ana")).remaining).toBe(1);
    expect(await limiter.consume("ana")).toMatchObject({ ok: true, remaining: 0 });
    advance(15_000);
    expect(await limiter.consume("ana")).toEqual({ ok: false, remaining: 0, retryAfterSeconds: 45 });
  });

  it("opens a new window once the old one ends", async () => {
    const { limiter, advance } = setup(1, 10_000);
    expect((await limiter.consume("ana")).ok).toBe(true);
    expect((await limiter.consume("ana")).ok).toBe(false);
    advance(10_000);
    expect(await limiter.consume("ana")).toMatchObject({ ok: true, retryAfterSeconds: 10 });
  });

  it("counts each subject separately and reset() clears one", async () => {
    const { limiter } = setup(1);
    await limiter.consume("ana");
    expect((await limiter.consume("ana")).ok).toBe(false);
    expect((await limiter.consume("bruno")).ok).toBe(true);
    await limiter.reset("ana");
    expect((await limiter.consume("ana")).ok).toBe(true);
  });

  it("keeps limiters with different names apart on one store", async () => {
    const store = memoryStore();
    const a = createRateLimiter({ name: "a", limit: 1, windowMs: 1000, store });
    const b = createRateLimiter({ name: "b", limit: 1, windowMs: 1000, store });
    await a.consume("x");
    expect((await b.consume("x")).ok).toBe(true);
  });

  it("bounds very long subjects (junk input cannot grow keys without limit)", async () => {
    const { limiter } = setup(1);
    await limiter.consume(`${"x".repeat(200)}A`);
    expect((await limiter.consume(`${"x".repeat(200)}B`)).ok).toBe(false);
  });

  it("rejects nonsense configuration", () => {
    const store = memoryStore();
    expect(() => createRateLimiter({ name: "x", limit: 0, windowMs: 1000, store })).toThrow(/limit/);
    expect(() => createRateLimiter({ name: "x", limit: 1.5, windowMs: 1000, store })).toThrow(/limit/);
    expect(() => createRateLimiter({ name: "x", limit: 1, windowMs: 0, store })).toThrow(/windowMs/);
  });
});

describe("waitMessage", () => {
  it("rounds up to whole minutes", () => {
    expect(waitMessage(1)).toBe("1 minuto");
    expect(waitMessage(60)).toBe("1 minuto");
    expect(waitMessage(61)).toBe("2 minutos");
    expect(waitMessage(15 * 60)).toBe("15 minutos");
  });
});

describe("clientIp", () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);

  it("takes the first X-Forwarded-For entry", () => {
    expect(clientIp(headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP, then to a shared 'unknown' bucket", () => {
    expect(clientIp(headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "" }))).toBe("unknown");
  });

  it("caps the length", () => {
    expect(clientIp(headers({ "x-forwarded-for": "9".repeat(500) }))).toHaveLength(64);
  });
});
