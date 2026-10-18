import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { orderTotals, type CouponTerms, type OrderTotals } from "@/lib/pricing";
import {
  couponLabel,
  couponRejection,
  couponRejectionMessage,
  termsOf,
  type CouponRejection,
  type CouponRow,
  type CouponUses,
} from "./rules";

/*
 * Coupons on the server: whether a code can be used (the cart's quote) and
 * the reservation of a use when the checkout prepares its order.
 *
 * A use counts toward a coupon's limits while it is RESERVED (its order
 * waits to be paid) or REDEEMED (paid). Reserving happens inside the
 * transaction that writes the order, with the coupon's row locked (FOR
 * UPDATE): two checkouts racing for its last use serialise there, and the
 * second one counts the first's reservation and is refused. So the limits
 * hold however many checkouts run at once. The per-customer limit counts the
 * uses of the account or of the email (a guest is their email; an account's
 * guest orders with the same email count too).
 *
 * After that, a use follows its order (a trigger in the coupons migration):
 * redeemed when it is paid, released when it is cancelled, by whatever path.
 * A re-prepared order that drops its coupon deletes its reservation here.
 *
 * Lock order: an order's row (when it is re-prepared), then the coupon's.
 * Nothing takes them the other way around.
 */

type Tx = Prisma.TransactionClient;

/** Who would use the coupon: their account and/or the order's email. */
export interface CouponCustomer {
  userId: string | null;
  email: string | null;
}

const COUNTED = ["RESERVED", "REDEEMED"] as const;

const couponSelect = {
  id: true,
  code: true,
  type: true,
  value: true,
  minSubtotal: true,
  startsAt: true,
  expiresAt: true,
  maxRedemptions: true,
  maxPerUser: true,
  active: true,
} as const satisfies Prisma.CouponSelect;

/** Uses that count toward the limits, leaving out `excludeOrderId`'s own (a re-prepared order). */
export async function countCouponUses(db: Db, couponId: string, customer: CouponCustomer, excludeOrderId: string | null): Promise<CouponUses> {
  const base: Prisma.CouponRedemptionWhereInput = {
    couponId,
    status: { in: [...COUNTED] },
    ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
  };
  const who: Prisma.CouponRedemptionWhereInput[] = [];
  if (customer.userId) who.push({ userId: customer.userId });
  if (customer.email) who.push({ email: customer.email.trim().toLowerCase() });
  const [total, mine] = await Promise.all([
    db.couponRedemption.count({ where: base }),
    who.length > 0 ? db.couponRedemption.count({ where: { ...base, OR: who } }) : Promise.resolve(0),
  ]);
  return { total, customer: mine };
}

export type CouponCheck =
  | { ok: true; coupon: CouponRow; terms: CouponTerms }
  | { ok: false; rejection: CouponRejection; coupon: CouponRow | null };

interface CheckOptions {
  now?: Date;
  /** The order being re-prepared: its own reservation does not count against it. */
  orderId?: string | null;
  /** Checked when given: the order's products must reach the coupon's minimum. */
  subtotal?: number;
}

async function check(db: Db, coupon: CouponRow | null, customer: CouponCustomer, { now = new Date(), orderId = null, subtotal }: CheckOptions): Promise<CouponCheck> {
  if (!coupon) return { ok: false, rejection: "not_found", coupon: null };
  const uses = await countCouponUses(db, coupon.id, customer, orderId);
  const rejection = couponRejection(coupon, uses, now) ?? (subtotal !== undefined && subtotal < coupon.minSubtotal ? "min_subtotal" : null);
  return rejection ? { ok: false, rejection, coupon } : { ok: true, coupon, terms: termsOf(coupon) };
}

/** Whether `code` can be used now by this customer (no lock: a quote; the reservation decides). */
export async function checkCoupon(db: Db, code: string, customer: CouponCustomer, options: CheckOptions = {}): Promise<CouponCheck> {
  const coupon = await db.coupon.findUnique({ where: { code }, select: couponSelect });
  return check(db, coupon, customer, options);
}

/**
 * The same check with the coupon's row locked until the transaction ends:
 * what the order then reserves cannot be taken by another checkout meanwhile.
 */
export async function lockCoupon(tx: Tx, code: string, customer: CouponCustomer, options: CheckOptions = {}): Promise<CouponCheck> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Coupon" WHERE "code" = ${code} FOR UPDATE`;
  const coupon = rows[0] ? await tx.coupon.findUnique({ where: { id: rows[0].id }, select: couponSelect }) : null;
  return check(tx, coupon, customer, options);
}

/** What the order's coupon came to: the terms to price it with (null: no coupon), or why it was refused. */
export type CouponClaim =
  | { ok: true; couponId: string | null; terms: CouponTerms | null }
  | { ok: false; rejection: CouponRejection; message: string };

/**
 * The coupon part of preparing an order, inside its transaction: no code is
 * no coupon; a code must pass every rule (minimum subtotal included) with the
 * coupon locked. Then price the order with `terms` and call holdOrderCoupon.
 */
export async function claimCoupon(
  tx: Tx,
  code: string | undefined,
  { customer, subtotal, orderId = null, now = new Date() }: { customer: CouponCustomer; subtotal: number; orderId?: string | null; now?: Date }
): Promise<CouponClaim> {
  if (!code) return { ok: true, couponId: null, terms: null };
  const checked = await lockCoupon(tx, code, customer, { now, orderId, subtotal });
  if (!checked.ok) return { ok: false, rejection: checked.rejection, message: couponRejectionMessage(checked.rejection, checked.coupon, subtotal) };
  return { ok: true, couponId: checked.coupon.id, terms: checked.terms };
}

/**
 * Records the order's use of its coupon (RESERVED), or drops it when the
 * order has none any more. Same transaction as claimCoupon, after the order
 * row exists with its totals.
 */
export async function holdOrderCoupon(
  tx: Tx,
  orderId: string,
  claim: Extract<CouponClaim, { ok: true }>,
  { customer, discount }: { customer: CouponCustomer; discount: number }
): Promise<void> {
  if (!claim.couponId) {
    await tx.couponRedemption.deleteMany({ where: { orderId, status: "RESERVED" } });
    return;
  }
  const data = {
    couponId: claim.couponId,
    userId: customer.userId,
    email: (customer.email ?? "").trim().toLowerCase(),
    discount,
    status: "RESERVED" as const,
    redeemedAt: null,
    releasedAt: null,
  };
  await tx.couponRedemption.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
}

// ---------------------------------------------------------------------------
// The cart's and the checkout's quote
// ---------------------------------------------------------------------------

/** What the browser gets for a code that applies: its terms (the discount math is lib/pricing) and the server's totals. */
export interface CouponQuote {
  coupon: CouponTerms & { label: string };
  totals: Pick<OrderTotals, "subtotal" | "discount" | "total" | "count" | "coupon"> & { shipping: number };
}

export type CouponQuoteOutcome = { ok: true; quote: CouponQuote } | { ok: false; rejection: CouponRejection; message: string };

/**
 * Whether `code` applies to these lines, priced from the database (the
 * browser's prices are never used). Products that are gone count for
 * nothing; stock is the checkout's business. A subtotal under the coupon's
 * minimum is not a refusal here: the coupon stays applied and the totals say
 * how much is missing (the order itself is refused until it is reached).
 */
export async function quoteCoupon(
  db: Db,
  { code, lines, customer, now = new Date() }: { code: string; lines: { productId: string; quantity: number }[]; customer: CouponCustomer; now?: Date }
): Promise<CouponQuoteOutcome> {
  const checked = await checkCoupon(db, code, customer, { now });
  if (!checked.ok) return { ok: false, rejection: checked.rejection, message: couponRejectionMessage(checked.rejection, checked.coupon) };

  const products = await db.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) }, archivedAt: null },
    select: { id: true, price: true },
  });
  const prices = new Map(products.map((product) => [product.id, product.price]));
  const priced = lines.flatMap((line) => {
    const price = prices.get(line.productId);
    return price === undefined ? [] : [{ price, quantity: line.quantity }];
  });
  const totals = orderTotals(priced, checked.terms);
  return {
    ok: true,
    quote: {
      coupon: { ...checked.terms, label: couponLabel(checked.terms) },
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping.cost,
        total: totals.total,
        count: totals.count,
        coupon: totals.coupon,
      },
    },
  };
}
