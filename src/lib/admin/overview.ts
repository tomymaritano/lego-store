import "server-only";

import type { OrderStatus } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";

export interface AdminOverview {
  products: number;
  outOfStock: number;
  lowStock: number;
  users: number;
  ordersByStatus: Record<OrderStatus, number>;
}

/** Stock at or under this (but above 0) counts as low. */
export const LOW_STOCK = 5;

/**
 * Counts for the admin home. Checks the admin itself (data access layer):
 * whoever calls it, a non-admin never gets the numbers.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  const db = getDb();
  const [products, outOfStock, lowStock, users, orders] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { stock: 0 } }),
    db.product.count({ where: { stock: { gt: 0, lte: LOW_STOCK } } }),
    db.user.count(),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const ordersByStatus: Record<OrderStatus, number> = { PENDING: 0, PAID: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
  for (const row of orders) ordersByStatus[row.status] = row._count._all;
  return { products, outOfStock, lowStock, users, ordersByStatus };
}
