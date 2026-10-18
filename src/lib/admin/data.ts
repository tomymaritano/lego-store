import "server-only";

import { cache } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import type { AdminOrderFilters, AdminProductFilters, AdminReviewFilters } from "@/lib/validations/admin";
import type { AuditEntityType, AuditFilters } from "@/lib/validations/audit";
import type { AdminCouponFilters } from "@/lib/validations/coupons";
import type { AdminUserFilters } from "@/lib/validations/users";
import { listAuditEntries, searchAuditLog } from "./audit";
import { getAdminCoupon, listAdminCoupons } from "./coupons";
import { getDashboard } from "./dashboard";
import { getAdminOrder, listAdminOrders } from "./orders";
import { adminCategories, getAdminProduct, listAdminProducts, productFormOptions } from "./products";
import { listAdminReviews, reviewedProducts } from "./reviews";
import { getAdminUser, listAdminUsers } from "./users";
import { getAdminCategory, listAdminCategories } from "./categories";
import { getAdminTheme, listAdminThemes } from "./themes";
import { getAdminSettings } from "./settings";
import { getAdminContentPage, listAdminContent } from "./content";
import type { ContentSlug } from "@/lib/content/pages";
import { getAdminMessage, listAdminMessages } from "@/lib/contact/messages";
import { listSubscribers } from "@/lib/newsletter";
import type { AdminMessageFilters, AdminSubscriberFilters } from "@/lib/validations/inbox";

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

export async function getAdminUsers(filters: AdminUserFilters) {
  await requireAdmin({ callbackUrl: "/admin/users" });
  return listAdminUsers(getDb(), filters);
}

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminUserDetail = cache(async (id: string) => {
  await requireAdmin({ callbackUrl: `/admin/users/${encodeURIComponent(id)}` });
  return getAdminUser(getDb(), id);
});

export async function getAdminCategoryList() {
  await requireAdmin({ callbackUrl: "/admin/categories" });
  return listAdminCategories(getDb());
}

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminCategoryDetail = cache(async (id: string) => {
  await requireAdmin({ callbackUrl: `/admin/categories/${encodeURIComponent(id)}` });
  return getAdminCategory(getDb(), id);
});

export async function getAdminThemeList() {
  await requireAdmin({ callbackUrl: "/admin/themes" });
  return listAdminThemes(getDb());
}

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminThemeDetail = cache(async (id: string) => {
  await requireAdmin({ callbackUrl: `/admin/themes/${encodeURIComponent(id)}` });
  return getAdminTheme(getDb(), id);
});

/** /admin/configuracion: the settings, the featured products and the settings' audit trail. */
export async function getAdminSettingsPage() {
  await requireAdmin({ callbackUrl: "/admin/configuracion" });
  return getAdminSettings(getDb());
}

/** /admin/contenido: every info page with its status. */
export async function getAdminContentList() {
  await requireAdmin({ callbackUrl: "/admin/contenido" });
  return listAdminContent(getDb());
}

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminContentDetail = cache(async (slug: ContentSlug) => {
  await requireAdmin({ callbackUrl: `/admin/contenido/${slug}` });
  return getAdminContentPage(getDb(), slug);
});

/** /admin/mensajes: the contact form's messages, filtered. */
export async function getAdminMessages(filters: AdminMessageFilters) {
  await requireAdmin({ callbackUrl: "/admin/mensajes" });
  return listAdminMessages(getDb(), filters);
}

/** Once per request (the page and its generateMetadata both read it). */
export const getAdminMessageDetail = cache(async (id: string) => {
  await requireAdmin({ callbackUrl: `/admin/mensajes/${encodeURIComponent(id)}` });
  const db = getDb();
  const message = await getAdminMessage(db, id);
  if (!message) return null;
  return { ...message, history: await listAuditEntries(db, "message", id, 10) };
});

/** /admin/newsletter: the subscribers, filtered. */
export async function getAdminSubscribers(filters: AdminSubscriberFilters) {
  await requireAdmin({ callbackUrl: "/admin/newsletter" });
  return listSubscribers(getDb(), filters);
}
