// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getProducts } from "@/app/api/products/route";
import { GET as getByIds } from "@/app/api/products/by-ids/route";
import { GET as getSearch } from "@/app/api/search/route";
import { proxy } from "@/proxy";

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
