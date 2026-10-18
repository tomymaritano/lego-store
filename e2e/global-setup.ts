import { readFileSync } from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { prepareAuthFixtures } from "./helpers/db";
import { E2E_PROD_DIST_DIR } from "./helpers/servers";

/**
 * Warms the dev server before the parallel workers start: each route is
 * compiled once, one after another. With a cold `next dev`, several workers
 * compiling different routes at the same moment could read a build manifest
 * while another compile was rewriting it ("Unexpected end of JSON input"),
 * which failed whichever spec happened to hit it.
 *
 * It also resets the auth fixtures in the dev database (helpers/db.ts) and
 * hands the run's admin password to the workers through the environment.
 *
 * Outside CI Playwright reuses whatever already listens on the e2e ports, so
 * it first checks both servers: the dev server must pay through the mock, and
 * the production server must serve this checkout's e2e build (its BUILD_ID).
 * A dev server from another checkout with the same flags is not detected:
 * pick free ports (E2E_DEV_PORT / E2E_PROD_PORT) when one may be running.
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
  // A dynamic route compiles on its first hit, whatever the id: a 404 or redirect still warms it.
  "/account/orders/warmup",
  "/admin",
];

export default async function globalSetup(config: FullConfig) {
  process.env.E2E_ADMIN_PASSWORD = await prepareAuthFixtures();

  const prodURL = config.projects.find((project) => project.name === "prod")?.use.baseURL;
  if (prodURL) await checkProdServer(prodURL);

  const baseURL = config.projects.find((project) => project.name === "chromium")?.use.baseURL;
  if (!baseURL) return;

  // The checkout specs pay through the mock gateway: a dev server reused from
  // `npm run dev` without STRIPE_MOCK=1 would show "Pagos no configurados".
  const checkout = await (await fetch(new URL("/checkout", baseURL))).text();
  if (!checkout.includes('data-payments-mode="mock"')) {
    throw new Error(
      `El servidor de ${baseURL} no corre con pagos simulados. Detén el servidor que está usando ese puerto ` +
        "(Playwright levanta el suyo con STRIPE_MOCK=1), reinícialo con STRIPE_MOCK=1 y STRIPE_WEBHOOK_SECRET=" +
        "whsec_e2e_lego_store_mock_only (ver e2e/helpers/stripe.ts) o elige otro puerto con E2E_DEV_PORT."
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

/**
 * The production server must serve the build this checkout made in
 * E2E_PROD_DIST_DIR: a `next start` reused from another checkout (or an
 * older build) would test other code. Each build's static files live under
 * /_next/static/<BUILD_ID>/, so only a server with this BUILD_ID has them.
 */
async function checkProdServer(prodURL: string) {
  let buildId: string | null = null;
  try {
    buildId = readFileSync(path.join(process.cwd(), E2E_PROD_DIST_DIR, "BUILD_ID"), "utf8").trim();
  } catch {
    // No build here: whatever answers on the port did not come from this checkout.
  }
  const response = buildId ? await fetch(new URL(`/_next/static/${buildId}/_buildManifest.js`, prodURL)) : null;
  if (!response?.ok) {
    throw new Error(
      `El servidor de ${prodURL} no sirve el build de e2e de esta copia (${E2E_PROD_DIST_DIR}/BUILD_ID). ` +
        "Detén el `next start` que está usando ese puerto para que Playwright levante el suyo, o elige otro puerto con E2E_PROD_PORT."
    );
  }
}
