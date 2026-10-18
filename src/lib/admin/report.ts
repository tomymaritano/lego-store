import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { STORE_TIME_ZONE } from "@/lib/argentina";
import type { Db } from "@/lib/lists/product";
import { paymentMethodTypeLabel } from "@/lib/orders/format";
import { PROVIDER_LABELS } from "@/lib/payments/provider";
import { daysOf } from "@/lib/validations/dashboard";
import { COLLECTED } from "./dashboard";
import { storeDate, storeDayEnd, storeDayStart } from "./format";

/*
 * The dashboard's report for a date range (/admin?from=…&to=…): revenue
 * KPIs, a conversion proxy, and the charts' data (sales per day, top
 * products, revenue by payment method, coupon usage). Revenue is what the
 * store kept: orders PAID, SHIPPED or DELIVERED, by the day they were paid
 * (a refund cancels the order, so it leaves the sums). Days are the store's
 * calendar days (Argentina). Client first; ./data.ts checks the admin.
 */

export interface DailySales {
  /** Store calendar day, "2026-10-18". */
  day: string;
  revenue: number;
  orders: number;
}

export interface ProductSales {
  productId: string | null;
  name: string;
  units: number;
  revenue: number;
}

export interface MethodRevenue {
  /** "Mercado Pago · Tarjeta de crédito". */
  label: string;
  revenue: number;
  orders: number;
}

export interface CouponUsage {
  code: string;
  /** Uses whose order was paid in the range. */
  uses: number;
  /** Pesos the store gave away with them. */
  discount: number;
  /** Uses held right now by orders waiting to be paid (whatever the range). */
  reserved: number;
}

export interface DashboardReport {
  range: { from: string; to: string; days: number };
  /** Paid in the range. */
  revenue: number;
  paidOrders: number;
  averageOrder: number;
  /** Fixed windows ending today (store days: today, the last 7 and the last 30, today included). */
  revenueToday: number;
  revenue7d: number;
  revenue30d: number;
  /** Checkouts that reached "Revisar" in the range (orders created) and how many of those got paid: a conversion proxy. */
  checkouts: number;
  checkoutsPaid: number;
  /** Orders placed ("Realizar pedido") in the range, by their status now. */
  placedByStatus: Record<OrderStatus, number>;
  newMessages: number;
  /** Sign-ups in the range still subscribed. */
  newSubscribers: number;
  sales: DailySales[];
  topProducts: ProductSales[];
  byMethod: MethodRevenue[];
  coupons: CouponUsage[];
}

const TOP_PRODUCTS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "paidAt" (a UTC timestamp) as its store calendar day, in SQL. */
const PAID_DAY = `to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE '${STORE_TIME_ZONE}', 'YYYY-MM-DD')`;

export async function getDashboardReport(db: Db, range: { from: string; to: string }, now = new Date()): Promise<DashboardReport> {
  const start = storeDayStart(range.from);
  const end = storeDayEnd(range.to);
  const todayStart = storeDayStart(storeDate(now));
  const daysBack = (days: number) => new Date(todayStart.getTime() - days * DAY_MS);
  const paidIn = { status: { in: COLLECTED }, paidAt: { gte: start, lt: end } } satisfies Prisma.OrderWhereInput;
  const collectedSince = (since: Date) => db.order.aggregate({ where: { status: { in: COLLECTED }, paidAt: { gte: since } }, _sum: { total: true } });
  const collected = COLLECTED as string[];

  const [paid, today, week, month, checkouts, checkoutsPaid, placed, newMessages, newSubscribers, daily, products, methods, couponRows, reserved] =
    await Promise.all([
      db.order.aggregate({ where: paidIn, _sum: { total: true }, _count: { _all: true } }),
      collectedSince(todayStart),
      collectedSince(daysBack(6)),
      collectedSince(daysBack(29)),
      db.order.count({ where: { createdAt: { gte: start, lt: end } } }),
      db.order.count({ where: { createdAt: { gte: start, lt: end }, status: { in: COLLECTED } } }),
      db.order.groupBy({ by: ["status"], where: { submittedAt: { gte: start, lt: end } }, _count: { _all: true } }),
      db.contactMessage.count({ where: { status: "NEW" } }),
      db.newsletterSubscriber.count({ where: { subscribedAt: { gte: start, lt: end }, unsubscribedAt: null } }),
      db.$queryRawUnsafe<{ day: string; revenue: number; orders: number }[]>(
        `SELECT ${PAID_DAY} AS "day", SUM("total")::int AS "revenue", COUNT(*)::int AS "orders"
         FROM "Order" WHERE "status"::text = ANY($1::text[]) AND "paidAt" >= $2 AND "paidAt" < $3
         GROUP BY 1 ORDER BY 1`,
        collected,
        start,
        end
      ),
      db.$queryRaw<{ productId: string | null; name: string; units: number; revenue: number }[]>`
        SELECT i."productId", MIN(i."name") AS "name", SUM(i."quantity")::int AS "units", SUM(i."quantity" * i."unitPrice")::int AS "revenue"
        FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
        WHERE o."status"::text = ANY(${collected}::text[]) AND o."paidAt" >= ${start} AND o."paidAt" < ${end}
        GROUP BY i."productId", CASE WHEN i."productId" IS NULL THEN i."name" END
        ORDER BY "revenue" DESC, "units" DESC, MIN(i."name")
        LIMIT ${TOP_PRODUCTS}`,
      db.order.groupBy({ by: ["paymentProvider", "paymentMethodType"], where: paidIn, _sum: { total: true }, _count: { _all: true } }),
      db.$queryRaw<{ code: string; uses: number; discount: number }[]>`
        SELECT c."code", COUNT(*)::int AS "uses", SUM(r."discount")::int AS "discount"
        FROM "CouponRedemption" r JOIN "Coupon" c ON c."id" = r."couponId" JOIN "Order" o ON o."id" = r."orderId"
        WHERE r."status" = 'REDEEMED' AND o."paidAt" >= ${start} AND o."paidAt" < ${end}
        GROUP BY c."code" ORDER BY "uses" DESC, c."code"`,
      db.couponRedemption.groupBy({
        by: ["couponId"],
        where: { status: "RESERVED", OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
        _count: { _all: true },
      }),
    ]);

  const placedByStatus: Record<OrderStatus, number> = { PENDING: 0, PAYMENT_PENDING: 0, PAID: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
  for (const row of placed) placedByStatus[row.status] = row._count._all;

  const byDay = new Map(daily.map((row) => [row.day, row]));
  const sales = daysOf(range).map((day) => ({ day, revenue: byDay.get(day)?.revenue ?? 0, orders: byDay.get(day)?.orders ?? 0 }));

  const byMethod = methods
    .map((row) => ({
      label: `${PROVIDER_LABELS[row.paymentProvider]} · ${paymentMethodTypeLabel(row.paymentMethodType) ?? (row.paymentProvider === "STRIPE" ? "Tarjeta" : "Otro medio")}`,
      revenue: row._sum.total ?? 0,
      orders: row._count._all,
    }))
    .sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));

  const codes = new Map(
    reserved.length > 0
      ? (await db.coupon.findMany({ where: { id: { in: reserved.map((row) => row.couponId) } }, select: { id: true, code: true } })).map((c) => [c.id, c.code])
      : []
  );
  const reservedByCode = new Map(reserved.map((row) => [codes.get(row.couponId) ?? row.couponId, row._count._all]));
  const coupons: CouponUsage[] = couponRows.map((row) => ({ ...row, reserved: reservedByCode.get(row.code) ?? 0 }));
  for (const [code, count] of reservedByCode) if (!coupons.some((row) => row.code === code)) coupons.push({ code, uses: 0, discount: 0, reserved: count });

  const revenue = paid._sum.total ?? 0;
  const paidOrders = paid._count._all;
  return {
    range: { from: range.from, to: range.to, days: sales.length },
    revenue,
    paidOrders,
    averageOrder: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
    revenueToday: today._sum.total ?? 0,
    revenue7d: week._sum.total ?? 0,
    revenue30d: month._sum.total ?? 0,
    checkouts,
    checkoutsPaid,
    placedByStatus,
    newMessages,
    newSubscribers,
    sales,
    topProducts: products,
    byMethod,
    coupons,
  };
}
