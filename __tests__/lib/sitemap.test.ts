// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SitemapSource } from "@/lib/api/catalog";
import { buildRobots, buildSitemap, ROBOTS_DISALLOW } from "@/lib/sitemap";

const SITE = "https://tienda.example";

const source: SitemapSource = {
  products: [
    { id: "1", updatedAt: "2026-10-01T12:00:00.000Z" },
    { id: "cm9 raro", updatedAt: "2026-10-02T12:00:00.000Z" },
  ],
  categories: [{ id: "helmet", updatedAt: "2026-09-01T00:00:00.000Z" }],
  pages: [
    { slug: "faq", publishedAt: "2026-10-17T10:00:00.000Z" },
    { slug: "terminos", publishedAt: null },
  ],
};

/** Every static route whose page or layout says `index: false` (src/app), as a path: "/cart", "/account/orders". */
function noindexRoutes(): string[] {
  const appDir = path.join(process.cwd(), "src", "app");
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Dynamic segments (an unknown product's page is noindex, a known one is not) are left out.
        if (!entry.name.startsWith("[") && entry.name !== "api") walk(full);
        continue;
      }
      if (!/^(page|layout)\.tsx$/.test(entry.name)) continue;
      if (!/robots:\s*\{\s*index:\s*false/.test(readFileSync(full, "utf8"))) continue;
      const segments = path
        .relative(appDir, dir)
        .split(path.sep)
        .filter((segment) => segment && !segment.startsWith("("));
      routes.push(`/${segments.join("/")}`);
    }
  };
  walk(appDir);
  return routes;
}

describe("buildSitemap", () => {
  const urls = buildSitemap(SITE, source).map((entry) => entry.url);

  it("lists the home page, the visible categories, the products on sale and the published info pages", () => {
    expect(urls).toEqual([
      `${SITE}/`,
      `${SITE}/category/helmet`,
      `${SITE}/item/1`,
      `${SITE}/item/cm9%20raro`,
      `${SITE}/faq`,
      `${SITE}/terminos`,
    ]);
  });

  it("dates each entry by its last change, and leaves the date out when there is none", () => {
    const entries = buildSitemap(SITE, source);
    expect(entries.find((entry) => entry.url === `${SITE}/item/1`)?.lastModified).toBe("2026-10-01T12:00:00.000Z");
    expect(entries.find((entry) => entry.url === `${SITE}/faq`)?.lastModified).toBe("2026-10-17T10:00:00.000Z");
    expect(entries.find((entry) => entry.url === `${SITE}/terminos`)).not.toHaveProperty("lastModified");
  });

  it("never lists a page marked noindex, nor anything robots.txt disallows", () => {
    const routes = noindexRoutes();
    // The scan found the pages it is meant to guard.
    expect(routes).toEqual(expect.arrayContaining(["/cart", "/checkout", "/search", "/login", "/admin", "/account", "/newsletter/baja"]));
    for (const url of urls) {
      const pathname = new URL(url).pathname;
      for (const route of routes) expect(pathname === route || pathname.startsWith(`${route}/`), `${pathname} is noindex (${route})`).toBe(false);
      for (const prefix of ROBOTS_DISALLOW) expect(pathname.startsWith(prefix), `${pathname} is disallowed (${prefix})`).toBe(false);
    }
  });

  it("works with a site URL that has a trailing slash", () => {
    expect(buildSitemap(`${SITE}/`, { products: [], categories: [], pages: [] }).map((entry) => entry.url)).toEqual([`${SITE}/`]);
  });
});

describe("buildRobots", () => {
  it("allows the store, keeps crawlers out of the admin, accounts, checkout, token links and the API, and points to the sitemap", () => {
    expect(buildRobots(SITE)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/newsletter/", "/api/"] },
      sitemap: `${SITE}/sitemap.xml`,
    });
  });
});
