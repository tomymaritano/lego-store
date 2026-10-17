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
  const spoofed = { "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.1", "x-real-ip": "6.6.6.6" };

  it("trusts no header without a trusted proxy: every client shares the 'unknown' bucket", () => {
    expect(clientIp(headers(spoofed), {})).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }), { TRUSTED_PROXY_HOPS: "0" })).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }), { TRUSTED_PROXY_HOPS: "dos" })).toBe("unknown");
  });

  it("behind N trusted proxies, takes the entry N from the right (what the outermost one saw)", () => {
    expect(clientIp(headers(spoofed), { TRUSTED_PROXY_HOPS: "1" })).toBe("10.0.0.1");
    expect(clientIp(headers(spoofed), { TRUSTED_PROXY_HOPS: "2" })).toBe("203.0.113.7");
    // Rotating the client-sent part does not change the key.
    expect(clientIp(headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7, 10.0.0.1" }), { TRUSTED_PROXY_HOPS: "2" })).toBe(
      "203.0.113.7"
    );
    // Fewer entries than proxies: the request skipped them.
    expect(clientIp(headers({ "x-forwarded-for": "10.0.0.1" }), { TRUSTED_PROXY_HOPS: "2" })).toBe("unknown");
    expect(clientIp(headers({}), { TRUSTED_PROXY_HOPS: "1" })).toBe("unknown");
  });

  it("on Vercel, takes the headers its edge overwrites", () => {
    const vercel = { VERCEL: "1" };
    expect(clientIp(headers({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "203.0.113.7" }), vercel)).toBe("198.51.100.2");
    expect(clientIp(headers({ "x-vercel-forwarded-for": "198.51.100.3" }), vercel)).toBe("198.51.100.3");
    expect(clientIp(headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }), vercel)).toBe("203.0.113.7");
    expect(clientIp(headers({}), vercel)).toBe("unknown");
  });

  it("caps the length", () => {
    expect(clientIp(headers({ "x-forwarded-for": "9".repeat(500) }), { TRUSTED_PROXY_HOPS: "1" })).toHaveLength(64);
  });
});
