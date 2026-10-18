import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { loadEnv } from "../../prisma/env";
import { E2E_ADMIN_EMAIL, E2E_EMAIL_DOMAIN, PASSWORD, uniqueEmail } from "./accounts";

/*
 * Auth fixtures in the dev database (the one the dev and prod servers use):
 * removes the accounts earlier runs created (all under E2E_EMAIL_DOMAIN),
 * clears the rate-limit counters (every spec logs in from the same address,
 * and a previous run's counters would otherwise lock this one out), and
 * creates an admin with a password random to this run. Orders the checkout
 * specs placed are removed too, and the stock they took is put back.
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

/**
 * Orders placed by the checkout specs (their emails use E2E_EMAIL_DOMAIN):
 * the stock their payments took goes back, then they are deleted, with the
 * webhook events the specs signed. (The dev server's catalogue cache may show
 * the lower stock until its next invalidation; only the database is reset.)
 */
const DELETE_E2E_ORDERS = [
  `UPDATE "Product" AS p SET "stock" = p."stock" + taken.quantity
   FROM (
     SELECT i."productId", SUM(i."quantity")::int AS quantity
     FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
     WHERE o."email" LIKE $1 AND o."paidAt" IS NOT NULL AND o."status" <> 'CANCELLED' AND i."productId" IS NOT NULL
     GROUP BY i."productId"
   ) AS taken
   WHERE p."id" = taken."productId"`,
  `DELETE FROM "Order" WHERE "email" LIKE $1`,
] as const;

async function deleteE2eOrders(client: Client) {
  for (const sql of DELETE_E2E_ORDERS) await client.query(sql, [`%@${E2E_EMAIL_DOMAIN}`]);
  await client.query(`DELETE FROM "ProcessedStripeEvent" WHERE "id" LIKE 'evt_e2e_%'`);
}

export function deleteE2eAccounts() {
  return withClient(async (client) => {
    await deleteE2eOrders(client);
    await client.query(`DELETE FROM "User" WHERE "email" LIKE $1`, [`%@${E2E_EMAIL_DOMAIN}`]);
    await client.query(REFRESH_RATINGS);
  });
}

/** The newest order placed with this email (the checkout specs use unique ones). */
export function latestOrder(
  email: string
): Promise<{ id: string; number: number; status: string; total: number; paymentIntentId: string | null } | null> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string; number: number; status: string; total: number; paymentIntentId: string | null }>(
      `SELECT "id", "number", "status", "total", "stripePaymentIntentId" AS "paymentIntentId"
       FROM "Order" WHERE "email" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  });
}

/** Returns the admin's password. */
export async function prepareAuthFixtures(): Promise<string> {
  const password = randomBytes(18).toString("base64url");
  // Cost 4: a test-only account; the app verifies any bcrypt cost.
  const hash = await bcrypt.hash(password, 4);
  await withClient(async (client) => {
    await deleteE2eOrders(client);
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

/**
 * Moves a product's stock by `delta` straight in the database (a stand-in for
 * a sale while an admin has the form open) and returns the new stock.
 */
export function addStock(productId: string, delta: number): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ stock: number }>(
      `UPDATE "Product" SET "stock" = "stock" + $2 WHERE "id" = $1 RETURNING "stock"`,
      [productId, delta]
    );
    return rows[0]!.stock;
  });
}

export function countHelpfulVotes(reviewId: string): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ count: string }>(`SELECT count(*) FROM "ReviewHelpful" WHERE "reviewId" = $1`, [reviewId]);
    return Number(rows[0]!.count);
  });
}

/**
 * A customer account created straight in the database (password PASSWORD),
 * for specs that need one signed in but are not about registering: the
 * register form's per-IP limit (20 an hour, and every local request shares
 * one bucket) is spent by the specs that are.
 */
export async function createE2eAccount(label: string, name: string, role: "USER" | "ADMIN" = "USER"): Promise<string> {
  const email = uniqueEmail(label);
  const hash = await bcrypt.hash(PASSWORD, 4);
  await withClient((client) =>
    client.query(
      `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "updatedAt") VALUES ($1, $2, $3, $4, $5, now())`,
      [`e2e-${randomBytes(8).toString("hex")}`, email, name, hash, role]
    )
  );
  return email;
}
