import { defineConfig, devices } from "@playwright/test";
import { E2E_SERVER_ENV } from "./e2e/helpers/stripe";

const DEV_URL = "http://localhost:3000";
/** Production server (`next build` + `next start`) for the e2e/prod specs. */
const PROD_PORT = 3100;
const PROD_URL = `http://localhost:${PROD_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Compiles each dev route once before the workers start (see the file).
  globalSetup: "./e2e/global-setup.ts",
  // Deletes the accounts the auth specs created (e2e/helpers/db.ts).
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      // stripe-live/ runs only with real test keys, from playwright.stripe-live.config.ts.
      testIgnore: ["prod/**", "stripe-live/**"],
      use: { ...devices["Desktop Chrome"], baseURL: DEV_URL },
    },
    {
      // Behaviour only the production build shows (router, page transitions).
      name: "prod",
      testDir: "./e2e/prod",
      use: { ...devices["Desktop Chrome"], baseURL: PROD_URL },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: DEV_URL,
      reuseExistingServer: !process.env.CI,
      // Payments through the mock gateway, webhooks signed by the specs (e2e/helpers/stripe.ts).
      // A reused dev server must have been started with these too: the global setup checks.
      env: E2E_SERVER_ENV,
    },
    {
      command: `npm run build && npx next start -p ${PROD_PORT}`,
      url: PROD_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      // Separate build folder: building into .next while `next dev` reads it
      // broke dev requests mid-run ("Unexpected end of JSON input").
      // AUTH_TRUST_HOST: Auth.js only trusts the Host header in production when told to
      // (Vercel sets it implicitly; a local `next start` does not).
      env: { NEXT_DIST_DIR: ".next-e2e", AUTH_TRUST_HOST: "true" },
    },
  ],
});
