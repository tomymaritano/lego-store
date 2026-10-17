// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { companyLinks, helpLinks, infoNav, legalLinks, themeLinks } from "@/config/navigation";
import { getCategories } from "@/lib/api";

const appDir = path.resolve(__dirname, "../../src/app");

/** Static page files under src/app, as URL paths (route groups stripped). */
function staticRoutes(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string, segments: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const isGroup = /^\(.*\)$/.test(entry.name);
        walk(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
      } else if (/^page\.tsx?$/.test(entry.name)) {
        routes.add("/" + segments.join("/"));
      }
    }
  };
  walk(appDir, []);
  return routes;
}

async function resolves(href: string, routes: Set<string>, categoryIds: Set<string>) {
  const pathname = href.split(/[?#]/)[0];
  if (routes.has(pathname)) return true;
  const category = pathname.match(/^\/category\/([^/]+)$/);
  return Boolean(category && categoryIds.has(category[1]));
}

describe("navigation config", () => {
  it("has no dead internal links", async () => {
    const routes = staticRoutes();
    const categoryIds = new Set((await getCategories()).map((c) => c.id));
    const hrefs = [...themeLinks, ...helpLinks, ...companyLinks, ...legalLinks, ...infoNav.flatMap((g) => g.items)].map(
      (l) => l.href
    );
    const dead: string[] = [];
    for (const href of hrefs) if (!(await resolves(href, routes, categoryIds))) dead.push(href);
    expect(dead).toEqual([]);
  });

  it("every literal internal href in src/ resolves to a page", async () => {
    const routes = staticRoutes();
    const categoryIds = new Set((await getCategories()).map((c) => c.id));
    const hrefs = new Set<string>();
    const hrefPattern = /href(?:=|:\s*)["'`](\/[^"'`$]*)["'`]/g;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.(stories|test)\./.test(entry.name)) {
          for (const match of fs.readFileSync(full, "utf8").matchAll(hrefPattern)) hrefs.add(match[1]);
        }
      }
    };
    walk(path.resolve(__dirname, "../../src"));
    expect(hrefs.size).toBeGreaterThan(10);
    const dead: string[] = [];
    for (const href of hrefs) if (!(await resolves(href, routes, categoryIds))) dead.push(href);
    expect(dead).toEqual([]);
  });

  it("covers the store info pages", () => {
    const routes = staticRoutes();
    for (const page of ["/faq", "/envios", "/devoluciones", "/contacto", "/nosotros", "/privacidad", "/terminos"]) {
      expect(routes.has(page), page).toBe(true);
    }
  });

  it("has no links to pages the store does not have", () => {
    const routes = staticRoutes();
    for (const page of [
      "/blog",
      "/careers",
      "/press",
      "/cookies",
      "/accessibility",
      "/shipping",
      "/returns",
      "/contact",
      "/about",
    ]) {
      expect(routes.has(page), page).toBe(false);
    }
  });
});
