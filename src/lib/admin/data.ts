import "server-only";

import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import type { AdminOrderFilters, AdminProductFilters, AdminReviewFilters } from "@/lib/validations/admin";
import { getDashboard } from "./dashboard";
import { getAdminOrder, listAdminOrders } from "./orders";
import { getAdminProduct, listAdminProducts, productFormOptions } from "./products";
import { listAdminReviews, reviewedProducts } from "./reviews";

/*
 * What the /admin pages read. Each function checks the admin itself (data
 * access layer): whoever calls it, a non-admin never gets the data, even if a
 * page forgot its own requireAdmin(). Reads go straight to the database,
 * never through the catalogue cache: the panel always shows the current rows.
 */

export async function getAdminDashboard() {
  await requireAdmin();
  return getDashboard(getDb());
}

export async function getAdminProducts(filters: AdminProductFilters) {
  await requireAdmin({ callbackUrl: "/admin/products" });
  return listAdminProducts(getDb(), filters);
}

export async function getAdminProductForEdit(id: string) {
  await requireAdmin({ callbackUrl: `/admin/products/${encodeURIComponent(id)}` });
  return getAdminProduct(getDb(), id);
}

export async function getProductFormOptions() {
  await requireAdmin({ callbackUrl: "/admin/products" });
  return productFormOptions(getDb());
}

export async function getAdminOrders(filters: AdminOrderFilters) {
  await requireAdmin({ callbackUrl: "/admin/orders" });
  return listAdminOrders(getDb(), filters);
}

export async function getAdminOrderDetail(id: string) {
  await requireAdmin({ callbackUrl: `/admin/orders/${encodeURIComponent(id)}` });
  return getAdminOrder(getDb(), id);
}

export async function getAdminReviews(filters: AdminReviewFilters) {
  await requireAdmin({ callbackUrl: "/admin/reviews" });
  const db = getDb();
  const [page, products] = await Promise.all([listAdminReviews(db, filters), reviewedProducts(db)]);
  return { ...page, products };
}
