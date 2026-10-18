/**
 * Resolves the test database URL and refuses anything that does not look
 * like one: the integration tests wipe it on every run. Shared by the Vitest
 * global setup, the per-worker setup and scripts/with-test-db.ts.
 */
export function testDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST no está definida. Levanta Postgres con `npm run db:up` y defínela en .env.local (ver .env.example)."
    );
  }
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(name)) {
    throw new Error(`DATABASE_URL_TEST apunta a "${name}": el nombre de la base de test tiene que incluir "test".`);
  }
  return url;
}
