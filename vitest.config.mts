import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

const alias = {
  "@": path.resolve(dirname, "./src"),
  // lib/api is marked server-only; tests run it directly, outside a React Server environment.
  "server-only": path.resolve(dirname, "./node_modules/server-only/empty.js"),
};

// Three projects:
// - unit: jsdom tests in __tests__ and src/**/*.test.* (no database)
// - integration: node tests in __tests__/integration against the test database
//   (DATABASE_URL_TEST, rebuilt from the migrations on every run; `npm run db:up` first)
// - storybook: every story rendered in a real browser (Playwright chromium)
// More info: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.stories.{ts,tsx}", "src/types/**", "src/app/**", "src/generated/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./__tests__/setup.tsx"],
          include: ["__tests__/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "__tests__/integration/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["__tests__/integration/**/*.test.ts"],
          globalSetup: ["./__tests__/integration/setup/global-setup.ts"],
          setupFiles: ["./__tests__/integration/setup/worker-setup.ts"],
          // One database for every file: run the files one after another.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // next-auth's ESM imports "next/server" without an extension, which Node's
          // resolver rejects; bundling it through Vite resolves it like Next does.
          server: { deps: { inline: ["next-auth"] } },
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
