import { defineConfig, devices } from "@playwright/test";

const DEV_URL = "http://localhost:3000";
/** Production server (`next build` + `next start`) for the e2e/prod specs. */
const PROD_PORT = 3100;
const PROD_URL = `http://localhost:${PROD_PORT}`;

export default defineConfig({
  testDir: "./e2e",
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
      testIgnore: "prod/**",
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
    },
    {
      command: `npm run build && npx next start -p ${PROD_PORT}`,
      url: PROD_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      // Separate build folder: building into .next while `next dev` reads it
      // broke dev requests mid-run ("Unexpected end of JSON input").
      env: { NEXT_DIST_DIR: ".next-e2e" },
    },
  ],
});
