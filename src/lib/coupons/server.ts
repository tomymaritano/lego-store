import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { orderTotals, type CouponTerms, type OrderTotals } from "@/lib/pricing";
import { readShippingRules } from "@/lib/settings";
import {
  couponLabel,
  couponRejection,
  couponRejectionMessage,
  limitRejection,
  termsOf,
  visibleRejection,
  type CouponRejection,
  type CouponRow,
  type CouponUses,
} from "./rules";

/*
 * Coupons on the server: whether a code can be used (the cart's quote), the
 * hold on a use while the checkout's order waits to be paid, and the check
 * when its payment is submitted.
 *
 * The coupon's total limit (maxRedemptions) counts only committed uses:
 * REDEEMED (paid) or RESERVED until the order settles (holdExpiresAt NULL: its
 * payment was submitted). An unpaid checkout costs nothing to make, so it
 * never takes one of the coupon's uses: anybody can prepare orders without
 * signing in, and a script that kept preparing them would otherwise keep a
 * small coupon ("the first 20 customers") used up for real buyers.
 * - "Revisar" (claimCoupon + holdOrderCoupon) records the order's use as
 *   RESERVED with a short hold (COUPON_HOLD_MS). The hold counts only toward
 *   the signed-in account's own per-customer limit, and it tells
 *   secureOrderCoupon whether the coupon's dates were already checked.
 * - "Realizar pedido" (secureOrderCoupon) checks the limits with the coupon
 *   locked (every rule, dates included, when the hold lapsed) and makes the
 *   use last until the order settles (holdExpiresAt NULL), before any money
 *   moves; a refused payment puts the short hold back (relaxOrderCoupon). So
 *   when the last uses are contested, the first to pay gets them and the
 *   others learn it when they submit their payment.
 * - A submitted payment that nobody has paid yet, and that costs nothing to
 *   submit, does not keep a committed use: a cash ticket (Rapipago, Pago
 *   Fácil) waits days to be paid, and a card's 3D Secure challenge can be
 *   left unanswered. Its order holds the use with a hold that runs as long as
 *   the payment may still come in (holdCouponUntilPaid): it counts toward the
 *   account's own limit only, not toward the coupon's total or an email's,
 *   and the approval checks the limits again (secureOrderCoupon) and gives
 *   the money back if the coupon no longer fits. So printing tickets (or
 *   abandoning 3D Secure) with a coupon, or with someone else's email, takes
 *   nobody's use.
 * - Checkout Pro ("Cuenta de Mercado Pago") is paid on Mercado Pago's site:
 *   opening it renews the short hold, its preference expires with it, and
 *   the payment's report runs the same check before the order becomes PAID
 *   or PAYMENT_PENDING (a payment that no longer fits is given back).
 * Both run with the coupon's row locked (FOR UPDATE): two payments racing
 * for its last use serialise there, and the second one counts the first's
 * committed use and is refused. So the limits hold however many checkouts run
 * at once.
 *
 * The per-customer limit (maxPerUser) counts:
 * - by account: the signed-in user's live uses, checked everywhere (quote,
 *   "Revisar", payment);
 * - by email (a guest is their email; an account's guest orders with the
 *   same email count too): only uses that are paid or whose payment was
 *   submitted and is under way (not an unpaid ticket), and only when the
 *   payment is submitted or approved. Anybody can type an
 *   email, so an unpaid checkout with someone's email never takes that
 *   person's uses, and neither the quote nor "Revisar" tells whether an
 *   email has used a coupon.
 *
 * After that, a use follows its order (a trigger in the coupons migration):
 * redeemed when it is paid, released when it is cancelled, by whatever path.
 * A re-prepared order that drops its coupon deletes its reservation here.
 *
 * Lock order: an order's row (when it is re-prepared or paid), then the
 * coupon's. Nothing takes them the other way around.
 */

type Tx = Prisma.TransactionClient;

/** Who would use the coupon: their account and/or the order's email. */
export interface CouponCustomer {
  userId: string | null;
  /** Counted only when given: the payment-time check passes it; the quote and "Revisar" do not. */
  email: string | null;
}

/** How long "Revisar" holds a coupon's use for an order whose payment has not been submitted. */
export const COUPON_HOLD_MS = 30 * 60 * 1000;

const holdUntil = (now: Date) => new Date(now.getTime() + COUPON_HOLD_MS);

/** An account's uses at `now`: paid, or held (a submitted payment, or "Revisar" within COUPON_HOLD_MS). What its own limit counts. */
const liveUse = (now: Date): Prisma.CouponRedemptionWhereInput => ({
  OR: [{ status: "REDEEMED" }, { status: "RESERVED", OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] }],
});

/** Uses someone paid for or submitted a payment for: what the coupon's total and an email's limit count. */
const committedUse: Prisma.CouponRedemptionWhereInput = {
  OR: [{ status: "REDEEMED" }, { status: "RESERVED", holdExpiresAt: null }],
};

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

/** Uses that count toward the limits at `now`, leaving out `excludeOrderId`'s own (a re-prepared or paying order). */
export async function countCouponUses(
  db: Db,
  couponId: string,
  customer: CouponCustomer,
  excludeOrderId: string | null,
  now: Date = new Date()
): Promise<CouponUses> {
  const base: Prisma.CouponRedemptionWhereInput = { couponId, ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}) };
  const who: Prisma.CouponRedemptionWhereInput[] = [];
  if (customer.userId) who.push({ AND: [{ userId: customer.userId }, liveUse(now)] });
  if (customer.email) who.push({ AND: [{ email: customer.email.trim().toLowerCase() }, committedUse] });
  const [total, mine] = await Promise.all([
    db.couponRedemption.count({ where: { AND: [base, committedUse] } }),
    who.length > 0 ? db.couponRedemption.count({ where: { AND: [base, { OR: who }] } }) : Promise.resolve(0),
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
  const uses = await countCouponUses(db, coupon.id, customer, orderId, now);
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
 * The coupon part of preparing an order ("Revisar"), inside its
 * transaction: no code is no coupon; a code must pass every rule (minimum
 * subtotal included) with the coupon locked. The per-customer limit is the
 * account's here; the email's is checked when the payment is submitted
 * (secureOrderCoupon). Then price the order with `terms` and call holdOrderCoupon.
 */
export async function claimCoupon(
  tx: Tx,
  code: string | undefined,
  { customer, subtotal, orderId = null, now = new Date() }: { customer: CouponCustomer; subtotal: number; orderId?: string | null; now?: Date }
): Promise<CouponClaim> {
  if (!code) return { ok: true, couponId: null, terms: null };
  const checked = await lockCoupon(tx, code, { userId: customer.userId, email: null }, { now, orderId, subtotal });
  if (!checked.ok) return { ok: false, rejection: checked.rejection, message: couponRejectionMessage(checked.rejection, checked.coupon, subtotal) };
  return { ok: true, couponId: checked.coupon.id, terms: checked.terms };
}

/**
 * Records the order's use of its coupon (RESERVED, held for COUPON_HOLD_MS),
 * or drops it when the order has none any more. Same transaction as
 * claimCoupon, after the order row exists with its totals.
 */
export async function holdOrderCoupon(
  tx: Tx,
  orderId: string,
  claim: Extract<CouponClaim, { ok: true }>,
  { customer, discount, now = new Date() }: { customer: CouponCustomer; discount: number; now?: Date }
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
    holdExpiresAt: holdUntil(now),
    redeemedAt: null,
    releasedAt: null,
  };
  await tx.couponRedemption.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
}

export type CouponSecured =
  | {
      ok: true;
      /** Until when the use is held: the short hold `extend: false` renewed; null when it is held until the order settles (or there is no coupon). */
      heldUntil: Date | null;
    }
  | { ok: false; rejection: CouponRejection; message: string };

/**
 * Checks the order's coupon again with the coupon locked (the order's row is
 * locked by the caller) and holds its use until the order settles. Runs:
 * - on "Realizar pedido", before any money moves;
 * - when a provider reports a payment for an order whose use is not held
 *   that way (Checkout Pro: the payment is made on Mercado Pago's site, so
 *   nothing was submitted here; a cash ticket or a 3D Secure payment, held
 *   by holdCouponUntilPaid until it is paid): before the order becomes PAID
 *   or PAYMENT_PENDING (src/lib/orders/mercadopago.ts applyLocked,
 *   src/lib/orders/webhook.ts onSucceeded). So a preference paid after its
 *   hold lapsed, one of several preferences with the same email, or a ticket
 *   paid after others used the coupon up, cannot take a use the coupon no
 *   longer has.
 *
 * What is checked:
 * - a live hold: the limits (its total, the account's and now the email's).
 *   The hold already passed the coupon's dates and active flag, and it keeps
 *   the use it holds even if the coupon is deactivated or expires meanwhile;
 * - a lapsed hold (holdExpiresAt <= now): it stopped counting, so this is a
 *   new use of the coupon, and it must pass every rule (active, dates, limits).
 *
 * Refused: the order has to be prepared again without it (or, for a payment
 * already made, it is given back). An order without a coupon, or one already
 * held until it settles (a retried payment), passes.
 *
 * `extend: false` (Checkout Pro, when the preference is opened) checks the
 * same and only renews the short hold (`heldUntil`: the preference expires
 * then too); the payment's report holds it for good (or refuses it).
 */
export async function secureOrderCoupon(
  tx: Tx,
  orderId: string,
  { now = new Date(), extend = true }: { now?: Date; extend?: boolean } = {}
): Promise<CouponSecured> {
  const held = await tx.couponRedemption.findUnique({
    where: { orderId },
    select: { couponId: true, userId: true, email: true, status: true, holdExpiresAt: true },
  });
  if (!held || held.status !== "RESERVED" || held.holdExpiresAt === null) return { ok: true, heldUntil: null };
  await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${held.couponId} FOR UPDATE`;
  const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: held.couponId }, select: couponSelect });
  const uses = await countCouponUses(tx, coupon.id, { userId: held.userId, email: held.email || null }, orderId, now);
  const lapsed = held.holdExpiresAt.getTime() <= now.getTime();
  const rejection = lapsed ? couponRejection(coupon, uses, now) : limitRejection(coupon, uses);
  if (rejection) return { ok: false, rejection, message: couponRejectionMessage(rejection, coupon) };
  const heldUntil = extend ? null : holdUntil(now);
  await tx.couponRedemption.update({ where: { orderId }, data: { holdExpiresAt: heldUntil } });
  return { ok: true, heldUntil };
}

/**
 * The order's payment was submitted but nothing is paid yet, and it costs
 * nothing to leave it that way (a cash ticket, a card waiting on 3D Secure):
 * its use is held until `until` (when the order stops waiting for it), which
 * counts toward the account's own limit only. The approval checks the limits
 * again (secureOrderCoupon). Called after the order's status changed (the
 * coupons trigger makes a PAYMENT_PENDING order's hold last until it settles).
 */
export async function holdCouponUntilPaid(tx: Tx, orderId: string, until: Date): Promise<void> {
  await tx.couponRedemption.updateMany({ where: { orderId, status: "RESERVED" }, data: { holdExpiresAt: until } });
}

/** A submitted payment was refused (the order stays at the checkout): its coupon goes back to a short hold. */
export async function relaxOrderCoupon(tx: Tx, orderId: string, now: Date = new Date()): Promise<void> {
  await tx.couponRedemption.updateMany({ where: { orderId, status: "RESERVED", holdExpiresAt: null }, data: { holdExpiresAt: holdUntil(now) } });
}

// ---------------------------------------------------------------------------
// The cart's and the checkout's quote
// ---------------------------------------------------------------------------

/** What the browser gets for a code that applies: its terms (the discount math is lib/pricing) and the server's totals. */
export interface CouponQuote {
  /** `recheckToken`: signed for the code by the Route Handler (src/lib/coupons/recheck.ts); null here. */
  coupon: CouponTerms & { label: string; recheckToken: string | null };
  totals: Pick<OrderTotals, "subtotal" | "discount" | "total" | "count" | "coupon"> & { shipping: number };
}

export type CouponQuoteOutcome = { ok: true; quote: CouponQuote } | { ok: false; rejection: CouponRejection; message: string };

/**
 * Whether `code` applies to these lines, priced from the database (the
 * browser's prices are never used). Products that are gone count for
 * nothing; stock is the checkout's business. A subtotal under the coupon's
 * minimum is not a refusal here: the coupon stays applied and the totals say
 * how much is missing (the order itself is refused until it is reached).
 * The per-customer limit is only the signed-in account's (`userId`).
 * `knownCode`: the browser proved it had this code accepted before (its
 * re-check token); otherwise an off or upcoming coupon reads as not found
 * (visibleRejection).
 */
export async function quoteCoupon(
  db: Db,
  {
    code,
    lines,
    userId,
    knownCode = false,
    now = new Date(),
  }: { code: string; lines: { productId: string; quantity: number }[]; userId: string | null; knownCode?: boolean; now?: Date }
): Promise<CouponQuoteOutcome> {
  const checked = await checkCoupon(db, code, { userId, email: null }, { now });
  if (!checked.ok) {
    const rejection = visibleRejection(checked.rejection, knownCode);
    return { ok: false, rejection, message: couponRejectionMessage(rejection, checked.coupon) };
  }

  const products = await db.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) }, archivedAt: null },
    select: { id: true, price: true },
  });
  const prices = new Map(products.map((product) => [product.id, product.price]));
  const priced = lines.flatMap((line) => {
    const price = prices.get(line.productId);
    return price === undefined ? [] : [{ price, quantity: line.quantity }];
  });
  const totals = orderTotals(priced, await readShippingRules(db), checked.terms);
  return {
    ok: true,
    quote: {
      coupon: { ...checked.terms, label: couponLabel(checked.terms), recheckToken: null },
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
