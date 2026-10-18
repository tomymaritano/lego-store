import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { couponLabel } from "@/lib/coupons/rules";
import type { Db } from "@/lib/lists/product";
import type { OrderStatus } from "@/lib/orders/types";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";
import type { AdminCouponFilters, CouponInput, CouponStatus } from "@/lib/validations/coupons";
import { diffFields, listAuditEntries, recordAudit, snapshotFields, type AuditActor, type AuditEntryView } from "./audit";
import { pageCount, type Page } from "./format";

/*
 * The admin's coupons (/admin/coupons). Client first, like the rest of the
 * admin's server code; no permission checks here (./data.ts and ./actions.ts
 * check the admin first). Every write records its AuditLog entry in the same
 * transaction.
 *
 * Coupons are never deleted: orders keep their code and discount, and the
 * redemptions point at the coupon. "Desactivar" stops new uses; orders that
 * already reserved one keep it. Editing the terms changes what the next
 * orders get, never the discount an order already has (its snapshot). The
 * code itself never changes.
 *
 * The list is computed in memory over every coupon matching the search
 * (a store has tens of them, not thousands): its status depends on the uses,
 * which come from one grouped query.
 */

export type { CouponStatus };

export interface CouponStats {
  /** Uses that count toward the total limit: redeemed + held (src/lib/coupons/server.ts). */
  uses: number;
  /** Unpaid orders whose use is live: in a checkout (a short hold) or waiting on a submitted payment (held). */
  reserved: number;
  /** The part of `reserved` whose payment was submitted: they count toward the limit until the order settles. */
  held: number;
  /** Reservations whose hold lapsed without a payment (the order is still unpaid): they no longer count. */
  lapsed: number;
  redeemed: number;
  released: number;
  /** Discount given on paid orders (redeemed uses). */
  discountGiven: number;
  /** What the paid orders that used it were charged (their totals). */
  revenue: number;
}

export interface AdminCouponRow extends CouponStats {
  id: string;
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: number;
  label: string;
  minSubtotal: number;
  startsAt: string | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  maxPerUser: number | null;
  active: boolean;
  status: CouponStatus;
  createdAt: string;
}

const couponSelect = {
  id: true,
  code: true,
  description: true,
  type: true,
  value: true,
  minSubtotal: true,
  startsAt: true,
  expiresAt: true,
  maxRedemptions: true,
  maxPerUser: true,
  active: true,
  createdAt: true,
} as const satisfies Prisma.CouponSelect;

type CouponRecord = Prisma.CouponGetPayload<{ select: typeof couponSelect }>;

const EMPTY_STATS: CouponStats = { uses: 0, reserved: 0, held: 0, lapsed: 0, redeemed: 0, released: 0, discountGiven: 0, revenue: 0 };

/** Where a coupon stands now: off, not started, over, used up, or usable. */
export function couponStatus(coupon: Pick<CouponRecord, "active" | "startsAt" | "expiresAt" | "maxRedemptions">, uses: number, now: Date): CouponStatus {
  if (!coupon.active) return "inactive";
  if (coupon.expiresAt && now >= coupon.expiresAt) return "expired";
  if (coupon.maxRedemptions !== null && uses >= coupon.maxRedemptions) return "exhausted";
  if (coupon.startsAt && now < coupon.startsAt) return "scheduled";
  return "active";
}

/** Uses per status and the money of the paid ones, for these coupons. */
async function statsOf(db: Db, couponIds: string[], now: Date): Promise<Map<string, CouponStats>> {
  const stats = new Map<string, CouponStats>();
  if (couponIds.length === 0) return stats;
  // A RESERVED use whose payment was submitted is HELD here (it counts toward the limit); one whose
  // short hold lapsed is LAPSED (src/lib/coupons/server.ts).
  const rows = await db.$queryRaw<{ couponId: string; status: "RESERVED" | "HELD" | "LAPSED" | "REDEEMED" | "RELEASED"; count: number; discount: number; revenue: number }[]>`
    SELECT s."couponId", s."status", COUNT(*)::int AS "count",
           COALESCE(SUM(s."discount"), 0)::int AS "discount",
           COALESCE(SUM(s."total"), 0)::int AS "revenue"
    FROM (
      SELECT r."couponId", r."discount", o."total",
             CASE WHEN r."status" = 'RESERVED' AND r."holdExpiresAt" IS NULL THEN 'HELD'
                  WHEN r."status" = 'RESERVED' AND r."holdExpiresAt" <= ${now} THEN 'LAPSED'
                  ELSE r."status"::text END AS "status"
      FROM "CouponRedemption" r JOIN "Order" o ON o."id" = r."orderId"
      WHERE r."couponId" = ANY(${couponIds}::text[])
    ) s
    GROUP BY s."couponId", s."status"
  `;
  for (const row of rows) {
    const entry = stats.get(row.couponId) ?? { ...EMPTY_STATS };
    if (row.status === "RESERVED") entry.reserved += row.count;
    if (row.status === "HELD") {
      entry.held = row.count;
      entry.reserved += row.count;
    }
    if (row.status === "LAPSED") entry.lapsed = row.count;
    if (row.status === "RELEASED") entry.released = row.count;
    if (row.status === "REDEEMED") {
      entry.redeemed = row.count;
      entry.discountGiven = row.discount;
      entry.revenue = row.revenue;
    }
    entry.uses = entry.held + entry.redeemed;
    stats.set(row.couponId, entry);
  }
  return stats;
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function toRow(coupon: CouponRecord, stats: CouponStats, now: Date): AdminCouponRow {
  return {
    ...coupon,
    ...stats,
    label: couponLabel(coupon),
    startsAt: iso(coupon.startsAt),
    expiresAt: iso(coupon.expiresAt),
    createdAt: coupon.createdAt.toISOString(),
    status: couponStatus(coupon, stats.uses, now),
  };
}

/** Coupons newest first, filtered by code (or note) and status, a page at a time. */
export async function listAdminCoupons(db: Db, filters: AdminCouponFilters, now = new Date()): Promise<Page<AdminCouponRow>> {
  const q = filters.q.trim();
  const coupons = await db.coupon.findMany({
    where: q
      ? { OR: [{ code: { contains: q.toUpperCase() } }, { description: { contains: q, mode: "insensitive" } }] }
      : undefined,
    select: couponSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1000,
  });
  const stats = await statsOf(
    db,
    coupons.map((coupon) => coupon.id),
    now
  );
  const rows = coupons
    .map((coupon) => toRow(coupon, stats.get(coupon.id) ?? EMPTY_STATS, now))
    .filter((row) => !filters.status || row.status === filters.status);
  const totalPages = pageCount(rows.length);
  const page = Math.min(filters.page, totalPages);
  return { items: rows.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE), total: rows.length, page, totalPages };
}

export interface CouponRedemptionView {
  id: string;
  /** LAPSED: reserved by an unpaid checkout whose hold ran out (it no longer counts). */
  status: "RESERVED" | "LAPSED" | "REDEEMED" | "RELEASED";
  discount: number;
  email: string;
  hasAccount: boolean;
  orderId: string;
  orderNumber: number;
  orderStatus: OrderStatus;
  orderTotal: number;
  at: string;
}

export interface AdminCouponDetail extends AdminCouponRow {
  redemptions: CouponRedemptionView[];
  history: AuditEntryView[];
}

/** One coupon with its latest uses and its audit trail. */
export async function getAdminCoupon(db: Db, id: string, now = new Date()): Promise<AdminCouponDetail | null> {
  const coupon = await db.coupon.findUnique({ where: { id }, select: couponSelect });
  if (!coupon) return null;
  const [stats, redemptions, history] = await Promise.all([
    statsOf(db, [coupon.id], now),
    db.couponRedemption.findMany({
      where: { couponId: coupon.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        holdExpiresAt: true,
        discount: true,
        email: true,
        userId: true,
        createdAt: true,
        order: { select: { id: true, number: true, status: true, total: true } },
      },
    }),
    listAuditEntries(db, "coupon", coupon.id),
  ]);
  return {
    ...toRow(coupon, stats.get(coupon.id) ?? EMPTY_STATS, now),
    redemptions: redemptions.map((row) => ({
      id: row.id,
      status: row.status === "RESERVED" && row.holdExpiresAt !== null && row.holdExpiresAt <= now ? "LAPSED" : row.status,
      discount: row.discount,
      email: row.email,
      hasAccount: row.userId !== null,
      orderId: row.order.id,
      orderNumber: row.order.number,
      orderStatus: row.order.status as OrderStatus,
      orderTotal: row.order.total,
      at: row.createdAt.toISOString(),
    })),
    history,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type CouponWriteResult =
  | { ok: true; couponId: string; changed: boolean }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "code_taken" };

const columnsOf = (input: CouponInput) => ({
  description: input.description,
  type: input.type,
  value: input.value,
  minSubtotal: input.minSubtotal,
  startsAt: input.startsAt,
  expiresAt: input.expiresAt,
  maxRedemptions: input.maxRedemptions,
  maxPerUser: input.maxPerUser,
  active: input.active,
});

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** A new coupon with `code` (already normalised). "code_taken" when another coupon has it. */
export async function createCoupon(db: PrismaClient, actor: AuditActor, code: string, input: CouponInput): Promise<CouponWriteResult> {
  try {
    const id = await db.$transaction(async (tx) => {
      const created = await tx.coupon.create({ data: { code, ...columnsOf(input) }, select: { id: true } });
      await recordAudit(tx, actor, { action: "coupon.create", entityType: "coupon", entityId: created.id, changes: snapshotFields({ code, ...columnsOf(input) }) });
      return created.id;
    });
    return { ok: true, couponId: id, changed: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "code_taken" };
    throw error;
  }
}

/** Saves the coupon's terms (never its code). The row is locked, so the entry's "before" is what was replaced. */
export async function updateCoupon(db: PrismaClient, actor: AuditActor, id: string, input: CouponInput): Promise<CouponWriteResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Coupon" WHERE "id" = ${id} FOR UPDATE`;
    if (locked.length === 0) return { ok: false, reason: "not_found" } as const;
    const before = await tx.coupon.findUniqueOrThrow({ where: { id }, select: couponSelect });
    const after = columnsOf(input);
    const changes = diffFields(before, after);
    if (Object.keys(changes).length === 0) return { ok: true, couponId: id, changed: false } as const;
    await tx.coupon.update({ where: { id }, data: after });
    const action = "active" in changes && Object.keys(changes).length === 1 ? (input.active ? "coupon.activate" : "coupon.deactivate") : "coupon.update";
    await recordAudit(tx, actor, { action, entityType: "coupon", entityId: id, changes });
    return { ok: true, couponId: id, changed: true } as const;
  });
}

/** "Desactivar" / "Activar": only `active` changes. */
export async function setCouponActive(db: PrismaClient, actor: AuditActor, id: string, active: boolean): Promise<CouponWriteResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ active: boolean }[]>`SELECT "active" FROM "Coupon" WHERE "id" = ${id} FOR UPDATE`;
    if (locked.length === 0) return { ok: false, reason: "not_found" } as const;
    if (locked[0]!.active === active) return { ok: true, couponId: id, changed: false } as const;
    await tx.coupon.update({ where: { id }, data: { active } });
    await recordAudit(tx, actor, {
      action: active ? "coupon.activate" : "coupon.deactivate",
      entityType: "coupon",
      entityId: id,
      changes: { active: [!active, active] },
    });
    return { ok: true, couponId: id, changed: true } as const;
  });
}
