import { execSync } from "node:child_process";
import { Client } from "pg";
import { loadEnv } from "../../../prisma/env";
import { testDatabaseUrl } from "../../../prisma/test-database";

/** Advisory lock key of the integration run (any constant; one per test database). */
const RUN_LOCK_KEY = "lego-store:integration-tests";

/**
 * Once per `vitest run` (or per `vitest` watch session):
 *
 * 1. Takes a session-level Postgres advisory lock on the test database and
 *    holds it until the run ends. Every integration file TRUNCATEs and
 *    re-seeds the database, and fileParallelism: false only serialises files
 *    inside one Vitest process, so a second run against the same database
 *    (another terminal, a watch session left open, another agent) would wipe
 *    this one's rows mid-test. The second run fails fast with a clear message
 *    instead. The lock dies with the connection, so a crashed run never
 *    leaves it behind.
 * 2. Brings the test database up to the latest migration (`prisma migrate
 *    deploy`, which only applies what is pending). Each test file then empties
 *    and seeds the rows it needs (resetDatabase / resetAndSeed in ./db.ts), so
 *    runs never depend on what a previous run left behind. If the test database
 *    ever drifts from the migrations (an edited migration), rebuild it with
 *    `npm run test:db:setup`.
 */
export default async function setup() {
  loadEnv();
  const url = testDatabaseUrl();
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error("DATABASE_URL_TEST es la misma base que DATABASE_URL: los tests la borran.");
  }

  const lock = new Client({ connectionString: url });
  await lock.connect();
  const { rows } = await lock.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [
    RUN_LOCK_KEY,
  ]);
  if (!rows[0]?.locked) {
    await lock.end();
    const name = new URL(url).pathname.slice(1);
    throw new Error(
      `La base de test "${name}" está ocupada: otra corrida de tests de integración la está usando ` +
        "(¿un `npm test` en modo watch abierto?). Espera a que termine o apunta DATABASE_URL_TEST a otra base."
    );
  }

  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (error) {
    await lock.end();
    throw error;
  }

  return async () => {
    await lock.query("SELECT pg_advisory_unlock(hashtext($1))", [RUN_LOCK_KEY]).catch(() => {});
    await lock.end();
  };
}
