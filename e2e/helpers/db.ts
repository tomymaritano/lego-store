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
  // Their coupon uses go with them (CouponRedemption cascades).
  for (const sql of DELETE_E2E_ORDERS) await client.query(sql, [`%@${E2E_EMAIL_DOMAIN}`]);
  await client.query(`DELETE FROM "ProcessedStripeEvent" WHERE "id" LIKE 'evt_e2e_%'`);
  await deleteE2eCoupons(client);
}

/** Coupons the specs created (codes start with E2E_COUPON_PREFIX), with their uses and audit entries. */
export const E2E_COUPON_PREFIX = "E2E";

async function deleteE2eCoupons(client: Client) {
  const pattern = `${E2E_COUPON_PREFIX}%`;
  await client.query(`DELETE FROM "AuditLog" WHERE "entityType" = 'coupon' AND "entityId" IN (SELECT "id" FROM "Coupon" WHERE "code" LIKE $1)`, [pattern]);
  await client.query(`DELETE FROM "CouponRedemption" WHERE "couponId" IN (SELECT "id" FROM "Coupon" WHERE "code" LIKE $1)`, [pattern]);
  await client.query(`DELETE FROM "Coupon" WHERE "code" LIKE $1`, [pattern]);
}

/** A unique code for a spec's coupon (the teardown deletes it). */
export const e2eCouponCode = (label: string) => `${E2E_COUPON_PREFIX}${label.toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;

/** A coupon straight in the dev database, for specs that are not about creating one. */
export async function createE2eCoupon(
  label: string,
  { type = "PERCENT", value = 10, minSubtotal = 0, maxPerUser = null }: { type?: "PERCENT" | "FIXED"; value?: number; minSubtotal?: number; maxPerUser?: number | null } = {}
): Promise<string> {
  const code = e2eCouponCode(label);
  await withClient((client) =>
    client.query(
      `INSERT INTO "Coupon" ("id", "code", "type", "value", "minSubtotal", "maxPerUser", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [`e2e-${randomBytes(8).toString("hex")}`, code, type, value, minSubtotal, maxPerUser]
    )
  );
  return code;
}

/** Turns a spec's coupon off (or on) behind the shopper's back. */
export function setE2eCouponActive(code: string, active: boolean): Promise<void> {
  return withClient(async (client) => {
    await client.query(`UPDATE "Coupon" SET "active" = $2, "updatedAt" = now() WHERE "code" = $1`, [code, active]);
  });
}

/** Changes a spec's coupon's value behind the shopper's back (an admin's edit). */
export function setE2eCouponValue(code: string, value: number): Promise<void> {
  return withClient(async (client) => {
    await client.query(`UPDATE "Coupon" SET "value" = $2, "updatedAt" = now() WHERE "code" = $1`, [code, value]);
  });
}

/** The coupon use of the newest order placed with this email. */
export function latestOrderCoupon(email: string): Promise<{ couponCode: string | null; discount: number; total: number; redemption: string | null } | null> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ couponCode: string | null; discount: number; total: number; redemption: string | null }>(
      `SELECT o."couponCode", o."discount", o."total", r."status" AS "redemption"
       FROM "Order" o LEFT JOIN "CouponRedemption" r ON r."orderId" = o."id"
       WHERE o."email" = $1 ORDER BY o."createdAt" DESC LIMIT 1`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  });
}

export function deleteE2eAccounts() {
  return withClient(async (client) => {
    await deleteE2eOrders(client);
    await client.query(`DELETE FROM "User" WHERE "email" LIKE $1`, [`%@${E2E_EMAIL_DOMAIN}`]);
    await client.query(REFRESH_RATINGS);
  });
}

interface LatestOrder {
  id: string;
  number: number;
  status: string;
  total: number;
  paymentIntentId: string | null;
  /** Mercado Pago's payment of the latest attempt. */
  providerPaymentId: string | null;
}

/** The newest order placed with this email (the checkout specs use unique ones). */
export function latestOrder(email: string): Promise<LatestOrder | null> {
  return withClient(async (client) => {
    const { rows } = await client.query<LatestOrder>(
      `SELECT "id", "number", "status", "total", "stripePaymentIntentId" AS "paymentIntentId", "providerPaymentId"
       FROM "Order" WHERE "email" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  });
}

/**
 * A PAID order written straight to the database (no checkout, no Stripe), for
 * specs about how the admin page treats one. Its single line points at no
 * product, so the teardown's stock give-back skips it; the teardown deletes
 * it with the other e2e orders.
 */
export async function createPaidE2eOrder(label: string): Promise<{ id: string; number: number }> {
  const email = uniqueEmail(label);
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string; number: number }>(
      `INSERT INTO "Order" ("id", "email", "status", "firstName", "lastName", "phone", "address", "city", "state", "zipCode", "country",
         "subtotal", "shipping", "total", "stripePaymentIntentId", "paymentBrand", "paymentLast4", "submittedAt", "paidAt", "updatedAt")
       VALUES ($1, $2, 'PAID', 'Ana', 'Prueba', '+54 11 5555-0000', 'Av. Siempre Viva 742', 'Rosario', 'Santa Fe', '2000', 'Argentina',
         1000, 0, 1000, $3, 'visa', '4242', now(), now(), now())
       RETURNING "id", "number"`,
      [`e2e-order-${randomBytes(8).toString("hex")}`, email, `pi_e2e_${randomBytes(8).toString("hex")}`]
    );
    const order = rows[0]!;
    await client.query(
      `INSERT INTO "OrderItem" ("id", "orderId", "productId", "name", "unitPrice", "image", "quantity")
       SELECT $1, $2, NULL, 'Set de prueba', 1000, "images"[1], 1 FROM "Product" WHERE cardinality("images") > 0 ORDER BY "id" LIMIT 1`,
      [`e2e-item-${randomBytes(8).toString("hex")}`, order.id]
    );
    return order;
  });
}

/**
 * Clears the checkout's and the coupons' rate-limit counters. Every spec
 * shares one client address (the dev server trusts no proxy: "unknown"), so
 * the specs that pay would otherwise add up to more than one customer's
 * budget (checkout-pay: 15 per 15 min) within a single run. No spec tests
 * these limits (the integration tests do).
 */
export function clearCheckoutRateLimits(): Promise<void> {
  return withClient(async (client) => {
    await client.query(`DELETE FROM "RateLimit" WHERE "key" LIKE 'checkout-%' OR "key" LIKE 'coupon-%'`);
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
