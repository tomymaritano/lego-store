import { defineConfig, devices } from "@playwright/test";

/*
 * Checkout against REAL Stripe test mode: the browser fills Stripe's Payment
 * Element (an iframe from js.stripe.com), the server confirms the
 * PaymentIntent with the ConfirmationToken, a 3DS card goes through
 * handleNextAction, and the webhook gets the real event Stripe recorded.
 *
 *   npm run test:e2e:stripe
 *
 * Needs test keys (sk_test_/pk_test_) and a webhook secret in .env.local or
 * the environment: STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
 * STRIPE_WEBHOOK_SECRET. Without them every test is skipped. The regular
 * suite (playwright.config.ts) never runs this: it pays through the mock.
 *
 * Its own dev server (port 3200, its own build folder) without STRIPE_MOCK,
 * so it can run next to `npm run dev` or the regular e2e server.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the environment (CI secrets) is all there is.
}

/** Without test keys the spec skips itself; no server is started for nothing. */
const configured = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"].every((name) =>
  Boolean(process.env[name]?.trim())
);

const PORT = 3200;
const URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/stripe-live",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "html" : "list",
  timeout: 180_000,
  use: { ...devices["Desktop Chrome"], baseURL: URL, trace: "retain-on-failure" },
  webServer: configured
    ? {
        command: `npx next dev -p ${PORT}`,
        url: URL,
        reuseExistingServer: false,
        timeout: 180_000,
        env: { NEXT_DIST_DIR: ".next-stripe-live", STRIPE_MOCK: "0" },
      }
    : undefined,
});
