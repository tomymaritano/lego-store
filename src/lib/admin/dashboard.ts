import type { OrderStatus } from "@/generated/prisma/enums";
import type { Db } from "@/lib/lists/product";
import { LOW_STOCK, storeDate, storeDayStart } from "./format";
import { listAdminOrders, type AdminOrderRow } from "./orders";
import { lowStockProducts, type AdminProductRow } from "./products";

/*
 * The numbers of the admin home (/admin). Client first; ./data.ts checks the
 * admin. "Today" is the store's calendar day (Argentina).
 */

/** Statuses whose money the store keeps (a cancelled paid order was refunded). */
const COLLECTED: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

/** How far back the amount-mismatch warning looks: an old incident does not keep the banner up forever. */
export const MISMATCH_WINDOW_DAYS = 7;

export interface AdminDashboard {
  /** Orders placed ("Realizar pedido") today, whatever happened to them since. */
  ordersToday: number;
  /** Total of paid, shipped and delivered orders, ever and paid today (pesos). */
  revenue: number;
  revenueToday: number;
  /** Paid and waiting to ship. */
  toShip: number;
  /** Placed and waiting for the payment to be confirmed. */
  awaitingPayment: number;
  ordersByStatus: Record<OrderStatus, number>;
  /**
   * Cancelled in the last MISMATCH_WINDOW_DAYS because the charge did not
   * match the total: should never happen; worth a look.
   */
  amountMismatches: number;
  products: number;
  outOfStock: number;
  lowStock: number;
  lowStockProducts: AdminProductRow[];
  recentOrders: AdminOrderRow[];
  users: number;
}

export async function getDashboard(db: Db, now = new Date()): Promise<AdminDashboard> {
  const today = storeDayStart(storeDate(now));
  const listed = { archivedAt: null };
  const mismatchSince = new Date(now.getTime() - MISMATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [ordersToday, revenue, revenueToday, groups, amountMismatches, products, outOfStock, lowStock, low, recent, users] =
    await Promise.all([
      db.order.count({ where: { submittedAt: { gte: today } } }),
      db.order.aggregate({ where: { status: { in: COLLECTED } }, _sum: { total: true } }),
      db.order.aggregate({ where: { status: { in: COLLECTED }, paidAt: { gte: today } }, _sum: { total: true } }),
      db.order.groupBy({ by: ["status"], where: { submittedAt: { not: null } }, _count: { _all: true } }),
      db.order.count({ where: { status: "CANCELLED", cancelReason: "amount_mismatch", cancelledAt: { gte: mismatchSince } } }),
      db.product.count({ where: listed }),
      db.product.count({ where: { ...listed, stock: 0 } }),
      db.product.count({ where: { ...listed, stock: { gt: 0, lte: LOW_STOCK } } }),
      lowStockProducts(db),
      listAdminOrders(db, { status: "", q: "", from: "", to: "", page: 1 }),
      db.user.count(),
    ]);
  const ordersByStatus: Record<OrderStatus, number> = { PENDING: 0, PAID: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
  for (const row of groups) ordersByStatus[row.status] = row._count._all;
  return {
    ordersToday,
    revenue: revenue._sum.total ?? 0,
    revenueToday: revenueToday._sum.total ?? 0,
    toShip: ordersByStatus.PAID,
    awaitingPayment: ordersByStatus.PENDING,
    ordersByStatus,
    amountMismatches,
    products,
    outOfStock,
    lowStock,
    lowStockProducts: low,
    recentOrders: recent.items.slice(0, 6),
    users,
  };
}
