"use server";

import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { updateCatalog } from "@/lib/api/cache";
import { formText, type FormState } from "@/lib/auth/form-state";
import { getDb } from "@/lib/db";
import { ADMIN_ORDER_STATUS_LABELS } from "@/lib/orders/format";
import { getMercadoPago, getPaymentGateway } from "@/lib/payments/config";
import { deleteReview } from "@/lib/reviews/mutations";
import { orderTransitionSchema, productFormSchema, stockSeenSchema, stockUpdateSchema, type ProductField } from "@/lib/validations/admin";
import { idSchema } from "@/lib/validations/ids";
import { couponFormSchema, newCouponCodeSchema, type CouponField } from "@/lib/validations/coupons";
import { requireAdminActor } from "./actor";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "./categories";
import { createTheme, deleteTheme, moveTheme, updateTheme } from "./themes";
import { categoryFormSchema, moveSchema, themeFormSchema, type CategoryField, type ThemeField } from "@/lib/validations/catalog";
import { userBlockSchema, userRoleSchema } from "@/lib/validations/users";
import { createCoupon, setCouponActive, updateCoupon } from "./coupons";
import { changeOrderStatus } from "./orders";
import { archiveProduct, createProduct, removeProduct, restoreProduct, setProductStock, updateProduct } from "./products";
import { setUserBlocked, setUserRole, type UserWriteResult } from "./users";

/*
 * Server Actions of the admin panel. Each one checks the admin itself
 * (requireAdminActor: a signed-out caller is sent to log in, a customer gets
 * the 403), validates its input with zod, and writes through ./products.ts,
 * ./orders.ts, ./coupons.ts or the review mutations, which record the change
 * in the audit log (./audit.ts) with the admin and their IP. Then:
 *
 * - catalogue writes expire the cache tags they touched with updateCatalog
 *   (updateTag): the storefront's next request reads the new data, and the
 *   product pages of everyone else too (src/lib/api/cache.ts);
 * - refresh() re-renders the admin page the action came from, which reads
 *   the database directly.
 *
 * Coupon writes revalidate the coupon pages; coupons are not in the
 * catalogue cache (the checkout reads them from the database every time).
 */

export type AdminActionResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_FOUND_PRODUCT = "Ese producto ya no existe. Recarga la lista.";

const stockChanged = (stock: number) =>
  `El stock cambió mientras editabas (una venta, un reembolso u otro admin): ahora hay ${stock}. Revisa el número y vuelve a guardar.`;

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const PRODUCT_TEXT_FIELDS = [
  "name",
  "price",
  "originalPrice",
  "categoryId",
  "type",
  "age",
  "themeId",
  "interests",
  "pieces",
  "highlight",
  "imageSecondary",
  "gallery",
  "stock",
  "shortDescription",
  "description",
] as const satisfies readonly ProductField[];

const flag = (formData: FormData, name: string) => ["on", "true", "1"].includes(formText(formData, name));

function productFormValues(formData: FormData) {
  const values = Object.fromEntries(PRODUCT_TEXT_FIELDS.map((field) => [field, formText(formData, field)])) as Record<
    (typeof PRODUCT_TEXT_FIELDS)[number],
    string
  >;
  return { ...values, isNew: flag(formData, "isNew"), isOnSale: flag(formData, "isOnSale") };
}

/**
 * Creates (productId null) or saves a product from the form. A new product
 * opens its edit page; an edit stays on the form with a confirmation.
 */
export async function saveProductAction(
  productId: string | null,
  _previous: FormState<ProductField>,
  formData: FormData
): Promise<FormState<ProductField>> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/products" });
  const parsed = productFormSchema.safeParse(productFormValues(formData));
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ProductField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ProductField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors };
  }

  const db = getDb();
  if (productId === null) {
    const created = await createProduct(db, admin, parsed.data);
    if (!created.ok) {
      return { status: "error", message: "Revisa los campos marcados.", fieldErrors: created.reason === "invalid" ? created.fieldErrors : {} };
    }
    // A new product shows up in listings, search, its category's count.
    updateCatalog({ productIds: [created.productId], categories: true });
    redirect(`/admin/products/${encodeURIComponent(created.productId)}?created=1`);
  }

  const id = idSchema.safeParse(productId);
  const stockSeen = stockSeenSchema.safeParse(formText(formData, "stockSeen"));
  if (!stockSeen.success) return { status: "error", message: "Recarga la página y vuelve a intentarlo.", fieldErrors: {} };
  const saved = id.success ? await updateProduct(db, admin, id.data, parsed.data, stockSeen.data) : ({ ok: false, reason: "not_found" } as const);
  if (!saved.ok) {
    if (saved.reason === "stock_changed") {
      // The page re-renders with the current stock (and the form's stock field with it).
      refresh();
      return { status: "error", message: "Revisa los campos marcados.", fieldErrors: { stock: stockChanged(saved.stock) } };
    }
    return saved.reason === "invalid"
      ? { status: "error", message: "Revisa los campos marcados.", fieldErrors: saved.fieldErrors }
      : { status: "error", message: NOT_FOUND_PRODUCT };
  }
  // Its page, every listing, and the category counts (the category may have changed).
  updateCatalog({ productIds: [saved.productId], categories: true });
  refresh();
  return { status: "success", message: "Guardamos los cambios. Ya se ven en la tienda." };
}

/** Quick stock edit (products list, dashboard), from the stock the admin saw (`seen`). */
export async function updateStockAction(productId: unknown, stock: unknown, seen: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/products" });
  const asText = (value: unknown) => (typeof value === "number" ? String(value) : value);
  const parsed = stockUpdateSchema.safeParse({ productId, stock: asText(stock), seen: asText(seen) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Stock no válido." };
  const result = await setProductStock(getDb(), admin, parsed.data.productId, parsed.data.seen, parsed.data.stock);
  if (!result.ok) {
    if (result.reason === "not_found") return { ok: false, error: NOT_FOUND_PRODUCT };
    refresh();
    return { ok: false, error: `El stock cambió mientras tanto: ahora hay ${result.stock}. Revisa el número y vuelve a guardar.` };
  }
  // "In stock" filters and counts change with it.
  updateCatalog({ productIds: [parsed.data.productId] });
  refresh();
  return { ok: true, message: `Stock actualizado: ${parsed.data.stock}.` };
}

export async function archiveProductAction(productId: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/products" });
  const id = idSchema.safeParse(productId);
  if (!id.success || !(await archiveProduct(getDb(), admin, id.data))) return { ok: false, error: NOT_FOUND_PRODUCT };
  updateCatalog({ productIds: [id.data], categories: true });
  refresh();
  return { ok: true, message: "Archivamos el producto: ya no se ve en la tienda." };
}

export async function restoreProductAction(productId: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/products" });
  const id = idSchema.safeParse(productId);
  if (!id.success || !(await restoreProduct(getDb(), admin, id.data))) return { ok: false, error: NOT_FOUND_PRODUCT };
  updateCatalog({ productIds: [id.data], categories: true });
  refresh();
  return { ok: true, message: "El producto volvió a la tienda." };
}

/** "Eliminar": deletes it, or archives it when orders reference it (./products.ts removeProduct). */
export async function removeProductAction(productId: unknown): Promise<AdminActionResult & { removed?: "deleted" | "archived" }> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/products" });
  const id = idSchema.safeParse(productId);
  const outcome = id.success ? await removeProduct(getDb(), admin, id.data) : ({ result: "not_found" } as const);
  if (outcome.result === "not_found") return { ok: false, error: NOT_FOUND_PRODUCT };
  updateCatalog({ productIds: [id.data!], categories: true });
  // A deleted product's page is gone: the browser leaves for the list instead of re-rendering it.
  if (outcome.result !== "deleted") refresh();
  switch (outcome.result) {
    case "deleted":
      return { ok: true, removed: "deleted", message: "Eliminamos el producto." };
    case "archived":
      return {
        ok: true,
        removed: "archived",
        message: "Está en pedidos, así que lo archivamos en vez de eliminarlo: ya no se ve en la tienda.",
      };
    case "already_archived":
      return { ok: true, removed: "archived", message: "Está en pedidos, así que no se puede eliminar. Ya estaba archivado: no cambiamos nada." };
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const TRANSITION_DONE = {
  SHIPPED: "Marcamos el pedido como enviado y le avisamos al cliente por email.",
  DELIVERED: "Marcamos el pedido como entregado.",
  CANCELLED: "Cancelamos el pedido.",
} as const;

/** Moves an order to SHIPPED, DELIVERED or CANCELLED (./orders.ts changeOrderStatus has the rules). */
export async function changeOrderStatusAction(input: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/orders" });
  const parsed = orderTransitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "No entendimos ese cambio de estado." };

  const result = await changeOrderStatus(getDb(), { stripe: getPaymentGateway(), mercadopago: getMercadoPago() }, parsed.data, admin);
  if (result.ok) {
    // Cancelling a paid order put stock back: the storefront shows it again.
    if (result.restockedProductIds.length > 0) updateCatalog({ productIds: result.restockedProductIds });
    refresh();
    if (!result.changed) return { ok: true, message: `El pedido ya estaba ${ADMIN_ORDER_STATUS_LABELS[result.status].toLowerCase()}.` };
    return {
      ok: true,
      message: result.refundId ? "Cancelamos el pedido, reembolsamos el pago y devolvimos el stock." : TRANSITION_DONE[parsed.data.to],
    };
  }
  switch (result.reason) {
    case "not_found":
      return { ok: false, error: "Ese pedido no existe." };
    case "conflict":
      refresh();
      return { ok: false, error: `El pedido cambió mientras tanto: ahora está ${ADMIN_ORDER_STATUS_LABELS[result.status].toLowerCase()}. Revisa antes de seguir.` };
    case "not_allowed":
      return { ok: false, error: `Un pedido ${ADMIN_ORDER_STATUS_LABELS[result.status].toLowerCase()} no puede pasar a ese estado.` };
    case "payment_in_flight":
      return { ok: false, error: "El pago de este pedido se está procesando. Espera a que se confirme y vuelve a intentarlo." };
    case "payments_unconfigured":
      return { ok: false, error: "Los pagos no están configurados en este servidor: no se puede tocar el pago en el proveedor." };
    case "refund_failed":
      return { ok: false, error: "El proveedor de pagos no hizo el reembolso: el pedido sigue pagado, sin cambios. Inténtalo de nuevo en un rato." };
    case "refund_unknown":
      refresh();
      return {
        ok: false,
        error: "No pudimos confirmar el reembolso con el proveedor de pagos. Retuvimos el pedido para que no se envíe: reintenta la cancelación en un rato.",
      };
    case "refund_pending":
      refresh();
      return { ok: false, error: "Este pedido tiene un reembolso sin confirmar, así que no se puede enviar. Reintenta la cancelación para cerrarlo." };
    case "no_payment":
      return { ok: false, error: "Este pedido no tiene un pago asociado para reembolsar." };
  }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/**
 * Moderation: deletes any review (no per-user edit limit: that one is for
 * customers' own reviews). The product's rating is recomputed in the same
 * transaction; its page and the listings are refreshed.
 */
export async function deleteReviewAsAdminAction(reviewId: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/reviews" });
  const id = idSchema.safeParse(reviewId);
  if (!id.success) return { ok: false, error: "Esa reseña ya no existe." };
  const result = await deleteReview(getDb(), { id: admin.id, role: "ADMIN" }, id.data, { audit: admin });
  if (!result.ok) return { ok: false, error: "Esa reseña ya no existe." };
  updateCatalog({ productIds: [result.productId] });
  refresh();
  return { ok: true, message: "Eliminamos la reseña y recalculamos la calificación del producto." };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

const COUPON_FIELDS = ["code", "description", "type", "value", "minSubtotal", "startsAt", "expiresAt", "maxRedemptions", "maxPerUser"] as const;

const NOT_FOUND_COUPON = "Ese cupón ya no existe. Recarga la lista.";

function couponFormValues(formData: FormData) {
  const values = Object.fromEntries(COUPON_FIELDS.map((field) => [field, formText(formData, field)])) as Record<(typeof COUPON_FIELDS)[number], string>;
  return { ...values, active: flag(formData, "active") };
}

/** The pages that show a coupon (its list and its own page). */
function revalidateCoupon(couponId: string) {
  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${couponId}`);
}

/**
 * Creates (couponId null) or saves a coupon from the form. A new coupon
 * opens its page; an edit stays on the form with a confirmation. The code is
 * only read when creating: it never changes.
 */
export async function saveCouponAction(
  couponId: string | null,
  _previous: FormState<CouponField>,
  formData: FormData
): Promise<FormState<CouponField>> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/coupons" });
  const values = couponFormValues(formData);
  const parsed = couponFormSchema.safeParse(values);
  const code = couponId === null ? newCouponCodeSchema.safeParse(values.code) : null;
  if (!parsed.success || (code && !code.success)) {
    const fieldErrors: Partial<Record<CouponField, string>> = {};
    for (const issue of [...(parsed.success ? [] : parsed.error.issues), ...(code && !code.success ? code.error.issues.map((issue) => ({ ...issue, path: ["code"] })) : [])]) {
      const field = issue.path[0] as CouponField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors };
  }

  const db = getDb();
  if (couponId === null) {
    const created = await createCoupon(db, admin, code!.data!, parsed.data);
    if (!created.ok) {
      return created.reason === "code_taken"
        ? { status: "error", message: "Revisa los campos marcados.", fieldErrors: { code: "Ya hay un cupón con ese código." } }
        : { status: "error", message: NOT_FOUND_COUPON };
    }
    revalidateCoupon(created.couponId);
    redirect(`/admin/coupons/${encodeURIComponent(created.couponId)}?created=1`);
  }

  const id = idSchema.safeParse(couponId);
  const saved = id.success ? await updateCoupon(db, admin, id.data, parsed.data) : ({ ok: false, reason: "not_found" } as const);
  if (!saved.ok) return { status: "error", message: NOT_FOUND_COUPON };
  revalidateCoupon(saved.couponId);
  refresh();
  return {
    status: "success",
    message: saved.changed ? "Guardamos los cambios. Rigen para los próximos pedidos." : "No había cambios para guardar.",
  };
}

/** "Desactivar" / "Activar" from the list or the coupon's page. */
export async function setCouponActiveAction(couponId: unknown, active: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/coupons" });
  const id = idSchema.safeParse(couponId);
  if (!id.success || typeof active !== "boolean") return { ok: false, error: NOT_FOUND_COUPON };
  const result = await setCouponActive(getDb(), admin, id.data, active);
  if (!result.ok) return { ok: false, error: NOT_FOUND_COUPON };
  revalidateCoupon(id.data);
  refresh();
  if (!result.changed) return { ok: true, message: active ? "El cupón ya estaba activo." : "El cupón ya estaba desactivado." };
  return {
    ok: true,
    message: active
      ? "Activamos el cupón: ya se puede usar."
      : "Desactivamos el cupón: no se puede usar en pedidos nuevos. Los pedidos que ya lo tienen lo conservan.",
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const NOT_FOUND_USER = "Esa cuenta ya no existe. Recarga la lista.";

/** The pages that show an account (the list and its own page). */
function revalidateUser(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

function userRefusal(result: Exclude<UserWriteResult, { ok: true }>, what: "role" | "block"): AdminActionResult {
  switch (result.reason) {
    case "not_found":
      return { ok: false, error: NOT_FOUND_USER };
    case "self":
      return { ok: false, error: what === "role" ? "No puedes cambiar tu propio rol." : "No puedes bloquear tu propia cuenta." };
    case "last_admin":
      return {
        ok: false,
        error: `Es el único admin activo: nombra otro admin antes de ${what === "role" ? "quitarle el rol" : "bloquearlo"}.`,
      };
  }
}

/** "Hacer admin" / "Quitar admin" on a user's page. */
export async function setUserRoleAction(userId: unknown, role: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/users" });
  const parsed = userRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: NOT_FOUND_USER };
  const result = await setUserRole(getDb(), admin, parsed.data.userId, parsed.data.role);
  if (!result.ok) return userRefusal(result, "role");
  revalidateUser(parsed.data.userId);
  refresh();
  if (!result.changed) return { ok: true, message: parsed.data.role === "ADMIN" ? "Ya era admin." : "Ya era cliente." };
  return {
    ok: true,
    message: parsed.data.role === "ADMIN" ? "Ahora es admin: ve el panel desde su próxima página." : "Ya no es admin: perdió el acceso al panel.",
  };
}

/** "Bloquear" (with an optional note) / "Desbloquear" on a user's page. */
export async function setUserBlockedAction(userId: unknown, blocked: unknown, reason?: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/users" });
  const parsed = userBlockSchema.safeParse({ userId, blocked, reason: typeof reason === "string" ? reason : undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? NOT_FOUND_USER };
  const result = await setUserBlocked(getDb(), admin, parsed.data.userId, parsed.data.blocked, parsed.data.reason);
  if (!result.ok) return userRefusal(result, "block");
  revalidateUser(parsed.data.userId);
  refresh();
  if (!result.changed) return { ok: true, message: parsed.data.blocked ? "La cuenta ya estaba bloqueada." : "La cuenta ya estaba activa." };
  return {
    ok: true,
    message: parsed.data.blocked
      ? "Bloqueamos la cuenta: cerramos sus sesiones y ya no puede iniciar sesión."
      : "Desbloqueamos la cuenta: ya puede volver a iniciar sesión.",
  };
}

// ---------------------------------------------------------------------------
// Categories and themes
// ---------------------------------------------------------------------------

function formErrors<Field extends string>(issues: { path: PropertyKey[]; message: string }[]): Partial<Record<Field, string>> {
  const fieldErrors: Partial<Record<Field, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0] as Field | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

const NOT_FOUND_CATEGORY = "Esa categoría ya no existe. Recarga la lista.";
const NOT_FOUND_THEME = "Ese tema ya no existe. Recarga la lista.";

function categoryFormValues(formData: FormData) {
  return {
    slug: formText(formData, "slug"),
    name: formText(formData, "name"),
    description: formText(formData, "description"),
    image: formText(formData, "image"),
    imageAlt: formText(formData, "imageAlt"),
    visible: flag(formData, "visible"),
  };
}

/** The navigation, the home page and the filters read categories: their tags, and the admin lists. */
function categoriesChanged(productIds: string[] = []) {
  updateCatalog({ categories: true, productIds });
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
}

/**
 * Creates (categoryId null) or saves a category from its form. A new
 * category opens its page; a changed slug moves the page to the new URL.
 */
export async function saveCategoryAction(
  categoryId: string | null,
  _previous: FormState<CategoryField>,
  formData: FormData
): Promise<FormState<CategoryField>> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/categories" });
  const parsed = categoryFormSchema.safeParse(categoryFormValues(formData));
  if (!parsed.success) return { status: "error", message: "Revisa los campos marcados.", fieldErrors: formErrors<CategoryField>(parsed.error.issues) };

  const db = getDb();
  const id = categoryId === null ? null : idSchema.safeParse(categoryId);
  const result =
    id === null
      ? await createCategory(db, admin, parsed.data)
      : id.success
        ? await updateCategory(db, admin, id.data, parsed.data)
        : ({ ok: false, reason: "not_found" } as const);
  if (!result.ok) {
    switch (result.reason) {
      case "not_found":
        return { status: "error", message: NOT_FOUND_CATEGORY };
      case "slug_taken":
        return { status: "error", message: "Revisa los campos marcados.", fieldErrors: { slug: "Ya hay una categoría con ese slug." } };
      case "slug_redirect":
        return {
          status: "error",
          message: "Revisa los campos marcados.",
          fieldErrors: { slug: `Era el slug de «${result.categoryId}» y sus enlaces viejos llevan ahí: elige otro.` },
        };
    }
  }
  categoriesChanged(result.productIds);
  if (id === null) redirect(`/admin/categories/${encodeURIComponent(result.categoryId)}?created=1`);
  if (result.categoryId !== categoryId) redirect(`/admin/categories/${encodeURIComponent(result.categoryId)}?moved=1`);
  refresh();
  return { status: "success", message: result.changed ? "Guardamos los cambios. Ya se ven en la tienda." : "No había cambios para guardar." };
}

/** "Subir" / "Bajar" in the categories list. */
export async function moveCategoryAction(categoryId: unknown, direction: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/categories" });
  const parsed = moveSchema.safeParse({ id: categoryId, direction });
  if (!parsed.success) return { ok: false, error: NOT_FOUND_CATEGORY };
  const result = await moveCategory(getDb(), admin, parsed.data.id, parsed.data.direction);
  if (!result.ok) return { ok: false, error: NOT_FOUND_CATEGORY };
  if (result.moved) categoriesChanged();
  refresh();
  return { ok: true, message: result.moved ? "Cambiamos el orden de las categorías." : "Ya estaba en ese extremo." };
}

export async function deleteCategoryAction(categoryId: unknown): Promise<AdminActionResult & { removed?: "deleted" }> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/categories" });
  const id = idSchema.safeParse(categoryId);
  const result = id.success ? await deleteCategory(getDb(), admin, id.data) : ({ ok: false, reason: "not_found" } as const);
  if (!result.ok) {
    return result.reason === "in_use"
      ? {
          ok: false,
          error: `Tiene ${result.products === 1 ? "1 producto" : `${result.products} productos`} (archivados incluidos): muévelos a otra categoría u oculta esta.`,
        }
      : { ok: false, error: NOT_FOUND_CATEGORY };
  }
  categoriesChanged();
  return { ok: true, removed: "deleted", message: "Eliminamos la categoría." };
}

function themeFormValues(formData: FormData) {
  return { name: formText(formData, "name"), slug: formText(formData, "slug"), visible: flag(formData, "visible") };
}

/** The "Temas" menu and every product read (they carry the theme name), and the admin lists. */
function themesChanged(productIds: string[] = []) {
  updateCatalog({ themes: true, productIds });
  revalidatePath("/admin/themes");
  revalidatePath("/admin/products");
}

/** Creates (themeId null) or saves a theme from its form. */
export async function saveThemeAction(themeId: string | null, _previous: FormState<ThemeField>, formData: FormData): Promise<FormState<ThemeField>> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/themes" });
  const parsed = themeFormSchema.safeParse(themeFormValues(formData));
  if (!parsed.success) return { status: "error", message: "Revisa los campos marcados.", fieldErrors: formErrors<ThemeField>(parsed.error.issues) };

  const db = getDb();
  const id = themeId === null ? null : idSchema.safeParse(themeId);
  const result =
    id === null
      ? await createTheme(db, admin, parsed.data)
      : id.success
        ? await updateTheme(db, admin, id.data, parsed.data)
        : ({ ok: false, reason: "not_found" } as const);
  if (!result.ok) {
    switch (result.reason) {
      case "not_found":
        return { status: "error", message: NOT_FOUND_THEME };
      case "name_taken":
        return { status: "error", message: "Revisa los campos marcados.", fieldErrors: { name: "Ya hay un tema con ese nombre." } };
      case "slug_taken":
        return { status: "error", message: "Revisa los campos marcados.", fieldErrors: { slug: "Ya hay un tema con ese slug." } };
    }
  }
  themesChanged(result.productIds);
  if (id === null) redirect(`/admin/themes/${encodeURIComponent(result.themeId)}?created=1`);
  refresh();
  return { status: "success", message: result.changed ? "Guardamos los cambios. Ya se ven en la tienda." : "No había cambios para guardar." };
}

/** "Subir" / "Bajar" in the themes list. */
export async function moveThemeAction(themeId: unknown, direction: unknown): Promise<AdminActionResult> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/themes" });
  const parsed = moveSchema.safeParse({ id: themeId, direction });
  if (!parsed.success) return { ok: false, error: NOT_FOUND_THEME };
  const result = await moveTheme(getDb(), admin, parsed.data.id, parsed.data.direction);
  if (!result.ok) return { ok: false, error: NOT_FOUND_THEME };
  if (result.moved) themesChanged();
  refresh();
  return { ok: true, message: result.moved ? "Cambiamos el orden de los temas." : "Ya estaba en ese extremo." };
}

export async function deleteThemeAction(themeId: unknown): Promise<AdminActionResult & { removed?: "deleted" }> {
  const admin = await requireAdminActor({ callbackUrl: "/admin/themes" });
  const id = idSchema.safeParse(themeId);
  const result = id.success ? await deleteTheme(getDb(), admin, id.data) : ({ ok: false, reason: "not_found" } as const);
  if (!result.ok) {
    return result.reason === "in_use"
      ? {
          ok: false,
          error: `Lo usan ${result.products === 1 ? "1 producto" : `${result.products} productos`} (archivados incluidos): cámbiales el tema u oculta este.`,
        }
      : { ok: false, error: NOT_FOUND_THEME };
  }
  themesChanged();
  return { ok: true, removed: "deleted", message: "Eliminamos el tema." };
}
