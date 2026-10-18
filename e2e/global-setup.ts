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
  "/api/products/1/reviews",
  "/api/lists",
  "/api/search?q=star",
  "/login",
  "/register",
  "/account",
  "/account/orders",
  "/admin",
];

export default async function globalSetup(config: FullConfig) {
  process.env.E2E_ADMIN_PASSWORD = await prepareAuthFixtures();

  const baseURL = config.projects.find((project) => project.name === "chromium")?.use.baseURL;
  if (!baseURL) return;

  // The checkout specs pay through the mock gateway: a dev server reused from
  // `npm run dev` without STRIPE_MOCK=1 would show "Pagos no configurados".
  const checkout = await (await fetch(new URL("/checkout", baseURL))).text();
  if (!checkout.includes('data-payments-mode="mock"')) {
    throw new Error(
      `El servidor de ${baseURL} no corre con pagos simulados. Detené el \`npm run dev\` que está usando ese puerto ` +
        "(Playwright levanta el suyo con STRIPE_MOCK=1) o reinicialo con STRIPE_MOCK=1 y STRIPE_WEBHOOK_SECRET=" +
        "whsec_e2e_lego_store_mock_only (ver e2e/helpers/stripe.ts)."
    );
  }
  for (const route of ROUTES) {
    try {
      await (await fetch(new URL(route, baseURL))).arrayBuffer();
    } catch {
      // A route that fails here fails in its own spec with a real error.
    }
  }
}
