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

/**
 * The cached rating columns, recomputed from the reviews (the same numbers as
 * src/lib/api/ratings.ts): deleting accounts deletes their reviews by cascade,
 * which no trigger reflects in Product.rating / reviewCount.
 */
const REFRESH_RATINGS = `
  UPDATE "Product" AS p
  SET "rating" = s.avg, "reviewCount" = s.count
  FROM (
    SELECT p2."id",
           COALESCE(ROUND(AVG(r."rating")::numeric, 1), 0)::float8 AS avg,
           COUNT(r."id")::int AS count
    FROM "Product" p2
    LEFT JOIN "Review" r ON r."productId" = p2."id"
    GROUP BY p2."id"
  ) AS s
  WHERE s."id" = p."id" AND (p."rating" <> s.avg OR p."reviewCount" <> s.count)
`;

export function deleteE2eAccounts() {
  return withClient(async (client) => {
    await client.query(`DELETE FROM "User" WHERE "email" LIKE $1`, [`%@${E2E_EMAIL_DOMAIN}`]);
    await client.query(REFRESH_RATINGS);
  });
}

/** Returns the admin's password. */
export async function prepareAuthFixtures(): Promise<string> {
  const password = randomBytes(18).toString("base64url");
  // Cost 4: a test-only account; the app verifies any bcrypt cost.
  const hash = await bcrypt.hash(password, 4);
  await withClient(async (client) => {
    await client.query(`DELETE FROM "User" WHERE "email" LIKE $1`, [`%@${E2E_EMAIL_DOMAIN}`]);
    await client.query(REFRESH_RATINGS);
    await client.query(`DELETE FROM "RateLimit"`);
    await client.query(
      `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "updatedAt")
       VALUES ($1, $2, 'Admin E2E', $3, 'ADMIN', now())`,
      [`e2e-admin-${randomBytes(6).toString("hex")}`, E2E_ADMIN_EMAIL, hash]
    );
  });
  return password;
}

/**
 * Review counts straight from the dev database. A failed earlier run can leave
 * the dev server's data cache a step behind (its accounts, and their reviews
 * and votes, are deleted by cascade, which invalidates no cache tag), so the
 * review specs compare the page with the database, not with what it showed
 * before.
 */
export function countReviews(productId: string): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ count: string }>(`SELECT count(*) FROM "Review" WHERE "productId" = $1`, [productId]);
    return Number(rows[0]!.count);
  });
}

export function countHelpfulVotes(reviewId: string): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ count: string }>(`SELECT count(*) FROM "ReviewHelpful" WHERE "reviewId" = $1`, [reviewId]);
    return Number(rows[0]!.count);
  });
}
