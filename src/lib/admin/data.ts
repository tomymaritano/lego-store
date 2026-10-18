import "server-only";

import { cache } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import type { AdminOrderFilters, AdminProductFilters, AdminReviewFilters } from "@/lib/validations/admin";
import type { AuditEntityType, AuditFilters } from "@/lib/validations/audit";
import type { AdminCouponFilters } from "@/lib/validations/coupons";
import { listAuditEntries, searchAuditLog } from "./audit";
import { getAdminCoupon, listAdminCoupons } from "./coupons";
import { getDashboard } from "./dashboard";
import { getAdminOrder, listAdminOrders } from "./orders";
import { adminCategories, getAdminProduct, listAdminProducts, productFormOptions } from "./products";
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

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminProductForEdit = cache(async (id: string) => {
  await requireAdmin({ callbackUrl: `/admin/products/${encodeURIComponent(id)}` });
  return getAdminProduct(getDb(), id);
});

/** The categories alone (the products list's filter). */
export async function getAdminCategories() {
  await requireAdmin({ callbackUrl: "/admin/products" });
  return adminCategories(getDb());
}

/** Categories and the suggestions of the create / edit form (reads every product: only for the form). */
export async function getProductFormOptions() {
  await requireAdmin({ callbackUrl: "/admin/products" });
  return productFormOptions(getDb());
}

export async function getAdminOrders(filters: AdminOrderFilters) {
  await requireAdmin({ callbackUrl: "/admin/orders" });
  return listAdminOrders(getDb(), filters);
}

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminOrderDetail = cache(async (id: string) => {
  await requireAdmin({ callbackUrl: `/admin/orders/${encodeURIComponent(id)}` });
  return getAdminOrder(getDb(), id);
});

export async function getAdminReviews(filters: AdminReviewFilters) {
  await requireAdmin({ callbackUrl: "/admin/reviews" });
  const db = getDb();
  const [page, products] = await Promise.all([listAdminReviews(db, filters), reviewedProducts(db)]);
  return { ...page, products };
}

export async function getAdminCoupons(filters: AdminCouponFilters) {
  await requireAdmin({ callbackUrl: "/admin/coupons" });
  return listAdminCoupons(getDb(), filters);
}

/** The audit log (/admin/audit), filtered. */
export async function getAdminAuditLog(filters: AuditFilters) {
  await requireAdmin({ callbackUrl: "/admin/audit" });
  return searchAuditLog(getDb(), filters);
}

/** One record's audit trail (the history panels of the detail pages). */
export async function getAdminAuditHistory(entityType: AuditEntityType, entityId: string) {
  await requireAdmin();
  return listAuditEntries(getDb(), entityType, entityId);
}

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminCouponDetail = cache(async (id: string) => {
  await requireAdmin({ callbackUrl: `/admin/coupons/${encodeURIComponent(id)}` });
  return getAdminCoupon(getDb(), id);
});
