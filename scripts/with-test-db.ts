/**
 * Runs a command against the test database: `tsx scripts/with-test-db.ts <command…>`
 * sets DATABASE_URL to DATABASE_URL_TEST (after the same safety checks as the
 * integration tests) and runs the command with it. Used by `npm run test:db:setup`.
 */
import { spawnSync } from "node:child_process";
import { loadEnv } from "../prisma/env";
import { testDatabaseUrl } from "../prisma/test-database";

loadEnv();
const url = testDatabaseUrl();
if (process.env.DATABASE_URL === url) {
  throw new Error("DATABASE_URL_TEST es la misma base que DATABASE_URL: los tests la borran.");
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Uso: tsx scripts/with-test-db.ts <comando> [argumentos…]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
