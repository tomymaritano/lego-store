import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/**
 * Loads .env.local, then .env (the files `next dev` reads) for the Prisma CLI,
 * the seed and the integration tests. Variables already in the environment
 * win, so CI and scripts/with-test-db.ts can point DATABASE_URL elsewhere.
 * (Next's own loader skips .env.local when NODE_ENV is "test", which is
 * exactly when the integration tests need DATABASE_URL_TEST from it.)
 */
export function loadEnv(dir = process.cwd()): void {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(dir, file);
    if (!existsSync(fullPath)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(fullPath, "utf8")))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
