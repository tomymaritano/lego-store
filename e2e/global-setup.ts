import type { FullConfig } from "@playwright/test";
import { prepareAuthFixtures } from "./helpers/db";

/**
 * Warms the dev server before the parallel workers start: each route is
 * compiled once, one after another. With a cold `next dev`, several workers
 * compiling different routes at the same moment could read a build manifest
 * while another compile was rewriting it ("Unexpected end of JSON input"),
 * which failed whichever spec happened to hit it.
 *
 * It also resets the auth fixtures in the dev database (helpers/db.ts) and
 * hands the run's admin password to the workers through the environment.
 */
const ROUTES = [
  "/",
  "/search",
  "/search?q=zzzz",
  "/category/helmet",
  "/item/1",
  "/cart",
  "/wishlist",
  "/compare",
  "/checkout",
  "/faq",
  "/contacto",
  "/no-existe",
  "/api/products?page=1",
  "/api/products/facets",
  "/api/products/by-ids?ids=1",
  "/api/search?q=star",
  "/login",
  "/register",
  "/account",
  "/admin",
];

export default async function globalSetup(config: FullConfig) {
  process.env.E2E_ADMIN_PASSWORD = await prepareAuthFixtures();

  const baseURL = config.projects.find((project) => project.name === "chromium")?.use.baseURL;
  if (!baseURL) return;
  for (const route of ROUTES) {
    try {
      await (await fetch(new URL(route, baseURL))).arrayBuffer();
    } catch {
      // A route that fails here fails in its own spec with a real error.
    }
  }
}
