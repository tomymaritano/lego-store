import { execSync } from "node:child_process";
import { loadEnv } from "../../../prisma/env";
import { testDatabaseUrl } from "../../../prisma/test-database";

/**
 * Once per `vitest run`: brings the test database up to the latest migration
 * (`prisma migrate deploy`, which only applies what is pending). Each test
 * file then empties and seeds the rows it needs (resetDatabase / resetAndSeed
 * in ./db.ts), so runs never depend on what a previous run left behind.
 * If the test database ever drifts from the migrations (an edited migration),
 * rebuild it with `npm run test:db:setup`.
 */
export default function setup() {
  loadEnv();
  const url = testDatabaseUrl();
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error("DATABASE_URL_TEST es la misma base que DATABASE_URL: los tests la borran.");
  }
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
