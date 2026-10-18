import { beforeAll, describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getProducts } from "@/app/api/products/route";
import { GET as getFacets } from "@/app/api/products/facets/route";
import { GET as getByIds } from "@/app/api/products/by-ids/route";
import { GET as getSearch } from "@/app/api/search/route";
import { proxy } from "@/proxy";
import { resetAndSeed } from "./setup/db";

beforeAll(async () => {
  await resetAndSeed();
});

const request = (path: string) => new NextRequest(new URL(path, "http://localhost"));

describe("Route Handlers", () => {
  it("GET /api/products returns a filtered, sorted page", async () => {
    const res = await getProducts(request("/api/products?category=helmet&sort=price-desc&limit=2&page=2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ total: 5, page: 2, limit: 2, hasMore: true });
    expect(body.items).toHaveLength(2);
    expect(body.items[0].price).toBeGreaterThanOrEqual(body.items[1].price);
  });

  it("GET /api/products/by-ids keeps the order and skips unknown ids", async () => {
    const res = await getByIds(request("/api/products/by-ids?ids=4,zzz,2&ids=1"));
    const body = await res.json();
    expect(body.items.map((p: { id: string }) => p.id)).toEqual(["4", "2", "1"]);
  });

  it("GET /api/products/by-ids answers 400 to malformed ids or too many of them", async () => {
    expect((await getByIds(request(`/api/products/by-ids?ids=1,${"x".repeat(65)}`))).status).toBe(400);
    const many = Array.from({ length: 501 }, (_, i) => String(i)).join(",");
    expect((await getByIds(request(`/api/products/by-ids?ids=${many}`))).status).toBe(400);
    // Over one request's worth but within the bound: the first ones are resolved.
    const some = Array.from({ length: 120 }, (_, i) => String(i + 1)).join(",");
    expect((await getByIds(request(`/api/products/by-ids?ids=${some}`))).status).toBe(200);
  });

  it("GET /api/products/by-ids without ids returns an empty list", async () => {
    expect(await (await getByIds(request("/api/products/by-ids"))).json()).toEqual({ items: [] });
  });

  it("GET /api/search returns light rows and clamps the limit", async () => {
    const body = await (await getSearch(request("/api/search?q=STAR%20wars&limit=99"))).json();
    expect(body.items.length).toBeLessThanOrEqual(10);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items[0]).not.toHaveProperty("description");

    const empty = await (await getSearch(request("/api/search?q="))).json();
    expect(empty).toEqual({ items: [], total: 0 });
  });
});

describe("Route Handlers with hostile input (no 500s)", () => {
  it.each([
    "/api/products?maxPrice=1e12",
    "/api/products?minPrice=99999999999&sort=price-asc",
    "/api/products?minPrice=3000000000&minRating=99",
    "/api/products?category=%00",
    "/api/products?q=%00&theme=%00",
  ])("GET %s answers 200", async (path) => {
    const res = await getProducts(request(path));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ page: 1 });
  });

  it("an out-of-range minimum price returns an empty page, a huge maximum the whole catalogue", async () => {
    expect(await (await getProducts(request("/api/products?minPrice=99999999999"))).json()).toMatchObject({ total: 0 });
    const all = await (await getProducts(request("/api/products"))).json();
    expect(await (await getProducts(request("/api/products?maxPrice=1e12"))).json()).toMatchObject({ total: all.total });
  });

  it.each(["/api/products/facets?minPrice=3000000000", "/api/products/facets?maxPrice=1e12&category=%00", "/api/products/facets?q=%00"])(
    "GET %s answers 200",
    async (path) => {
      const res = await getFacets(request(path));
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveProperty("flags");
    }
  );

  it("a very long search costs no more than its first terms", async () => {
    const q = Array.from({ length: 2500 }, (_, i) => `t${i}`).join(" ");
    const res = await getFacets(request(`/api/products/facets?q=${encodeURIComponent(q)}`));
    expect(res.status).toBe(200);
  });

  it("GET /api/search with a NUL byte returns no results", async () => {
    const res = await getSearch(request("/api/search?q=%00"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], total: 0 });
  });
});

describe("proxy (real 404 status)", () => {
  it.each(["/item/1", "/category/helmet"])("lets %s through", async (path) => {
    const res = await proxy(request(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it.each(["/item/nope", "/item/%E0%A4%A", "/category/nope"])("rewrites %s to the not-found page with a 404", async (path) => {
    const res = await proxy(request(path));
    expect(res.status).toBe(404);
    expect(res.headers.get("x-middleware-rewrite")).toMatch(/\/not-found\/__missing$/);
  });
});

describe("proxy (protected sections)", () => {
  const SECRET = process.env.AUTH_SECRET ?? "integration-test-secret";
  process.env.AUTH_SECRET = SECRET;

  /** A request carrying a session cookie signed like Auth.js signs it. */
  async function withSession(path: string, method = "GET") {
    const { encode } = await import("next-auth/jwt");
    const salt = "authjs.session-token";
    const token = await encode({ token: { sub: "someone", role: "USER", sv: 0 }, secret: SECRET, salt });
    // Auth.js builds its session URL from Host and X-Forwarded-Proto, which Next sets on every
    // real request (without the protocol it assumes https and looks for the __Secure- cookie).
    return new NextRequest(new URL(path, "http://localhost"), {
      method,
      headers: { host: "localhost", "x-forwarded-proto": "http", cookie: `${salt}=${token}` },
    });
  }

  it.each([
    ["/account", "/login?callbackUrl=%2Faccount"],
    ["/account/orders/abc?tab=1", "/login?callbackUrl=%2Faccount%2Forders%2Fabc%3Ftab%3D1"],
    ["/admin", "/login?callbackUrl=%2Fadmin"],
  ])("sends a visitor without a session from %s to login", async (path, location) => {
    const res = await proxy(request(path));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search).toBe(location);
  });

  it("lets a signed session through (the pages then check the user and role in the database)", async () => {
    for (const path of ["/account", "/admin"]) {
      const res = await proxy(await withSession(path));
      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
    }
  });

  it("ignores a cookie that was not signed with the secret", async () => {
    const forged = new NextRequest(new URL("/admin", "http://localhost"), {
      headers: { host: "localhost", "x-forwarded-proto": "http", cookie: "authjs.session-token=not-a-real-token" },
    });
    expect((await proxy(forged)).status).toBe(307);
  });

  it("leaves Server Action POSTs to their own checks (no redirect on POST)", async () => {
    const res = await proxy(new NextRequest(new URL("/account", "http://localhost"), { method: "POST" }));
    expect(res.headers.get("location")).toBeNull();
  });
});
