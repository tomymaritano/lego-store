import { test, expect } from "@playwright/test";

/** The production build serves /sitemap.xml and /robots.txt from the database (src/app/sitemap.ts, robots.ts). */
test("sitemap.xml lists the store's indexable pages and robots.txt keeps crawlers out of the private ones", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("xml");
  const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]!).pathname);
  expect(locs).toContain("/");
  expect(locs).toContain("/item/1");
  expect(locs).toContain("/category/helmet");
  expect(locs).toContain("/faq");
  for (const path of locs) expect(path, path).toMatch(/^\/($|item\/|category\/|faq$|envios$|devoluciones$|nosotros$|privacidad$|terminos$|contacto$)/);

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const text = await robots.text();
  for (const path of ["/admin", "/account", "/checkout", "/newsletter/", "/api/"]) expect(text).toContain(`Disallow: ${path}`);
  expect(text).toMatch(/Sitemap: https?:\/\/[^/]+\/sitemap\.xml/);
});
