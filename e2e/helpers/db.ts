import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { loadEnv } from "../../prisma/env";
import { E2E_ADMIN_EMAIL, E2E_EMAIL_DOMAIN } from "./accounts";

/*
 * Auth fixtures in the dev database (the one the dev and prod servers use):
 * removes the accounts earlier runs created (all under E2E_EMAIL_DOMAIN),
 * clears the rate-limit counters (every spec logs in from the same address,
 * and a previous run's counters would otherwise lock this one out), and
 * creates an admin with a password random to this run.
 */

async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  loadEnv();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export function deleteE2eAccounts() {
  return withClient((client) => client.query(`DELETE FROM "User" WHERE "email" LIKE $1`, [`%@${E2E_EMAIL_DOMAIN}`]));
}

/** Returns the admin's password. */
export async function prepareAuthFixtures(): Promise<string> {
  const password = randomBytes(18).toString("base64url");
  // Cost 4: a test-only account; the app verifies any bcrypt cost.
  const hash = await bcrypt.hash(password, 4);
  await withClient(async (client) => {
    await client.query(`DELETE FROM "User" WHERE "email" LIKE $1`, [`%@${E2E_EMAIL_DOMAIN}`]);
    await client.query(`DELETE FROM "RateLimit"`);
    await client.query(
      `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "updatedAt")
       VALUES ($1, $2, 'Admin E2E', $3, 'ADMIN', now())`,
      [`e2e-admin-${randomBytes(6).toString("hex")}`, E2E_ADMIN_EMAIL, hash]
    );
  });
  return password;
}
