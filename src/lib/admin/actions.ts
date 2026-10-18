"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { updateCatalog } from "@/lib/api/cache";
import { formText, type FormState } from "@/lib/auth/form-state";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ORDER_STATUS_LABELS } from "@/lib/orders/format";
import { getPaymentGateway } from "@/lib/payments/config";
import { deleteReview } from "@/lib/reviews/mutations";
import { orderTransitionSchema, productFormSchema, stockSeenSchema, stockUpdateSchema, type ProductField } from "@/lib/validations/admin";
import { idSchema } from "@/lib/validations/ids";
import { changeOrderStatus } from "./orders";
import { archiveProduct, createProduct, removeProduct, restoreProduct, setProductStock, updateProduct } from "./products";

/*
 * Server Actions of the admin panel. Each one checks the admin itself
 * (requireAdmin: a signed-out caller is sent to log in, a customer gets the
 * 403), validates its input with zod, and writes through ./products.ts,
 * ./orders.ts or the review mutations. Then:
 *
 * - catalogue writes expire the cache tags they touched with updateCatalog
 *   (updateTag): the storefront's next request reads the new data, and the
 *   product pages of everyone else too (src/lib/api/cache.ts);
 * - refresh() re-renders the admin page the action came from, which reads
 *   the database directly.
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
  "theme",
  "interests",
  "pieces",
  "highlight",
  "img",
  "imageSecondary",
  "images",
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
  await requireAdmin({ callbackUrl: "/admin/products" });
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
    const created = await createProduct(db, parsed.data);
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
  const saved = id.success ? await updateProduct(db, id.data, parsed.data, stockSeen.data) : ({ ok: false, reason: "not_found" } as const);
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
  await requireAdmin({ callbackUrl: "/admin/products" });
  const asText = (value: unknown) => (typeof value === "number" ? String(value) : value);
  const parsed = stockUpdateSchema.safeParse({ productId, stock: asText(stock), seen: asText(seen) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Stock no válido." };
  const result = await setProductStock(getDb(), parsed.data.productId, parsed.data.seen, parsed.data.stock);
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
  await requireAdmin({ callbackUrl: "/admin/products" });
  const id = idSchema.safeParse(productId);
  if (!id.success || !(await archiveProduct(getDb(), id.data))) return { ok: false, error: NOT_FOUND_PRODUCT };
  updateCatalog({ productIds: [id.data], categories: true });
  refresh();
  return { ok: true, message: "Archivamos el producto: ya no se ve en la tienda." };
}

export async function restoreProductAction(productId: unknown): Promise<AdminActionResult> {
  await requireAdmin({ callbackUrl: "/admin/products" });
  const id = idSchema.safeParse(productId);
  if (!id.success || !(await restoreProduct(getDb(), id.data))) return { ok: false, error: NOT_FOUND_PRODUCT };
  updateCatalog({ productIds: [id.data], categories: true });
  refresh();
  return { ok: true, message: "El producto volvió a la tienda." };
}

/** "Eliminar": deletes it, or archives it when orders reference it (./products.ts removeProduct). */
export async function removeProductAction(productId: unknown): Promise<AdminActionResult & { removed?: "deleted" | "archived" }> {
  await requireAdmin({ callbackUrl: "/admin/products" });
  const id = idSchema.safeParse(productId);
  const outcome = id.success ? await removeProduct(getDb(), id.data) : ({ result: "not_found" } as const);
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
  const admin = await requireAdmin({ callbackUrl: "/admin/orders" });
  const parsed = orderTransitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "No entendimos ese cambio de estado." };

  const result = await changeOrderStatus(getDb(), getPaymentGateway(), parsed.data, admin);
  if (result.ok) {
    // Cancelling a paid order put stock back: the storefront shows it again.
    if (result.restockedProductIds.length > 0) updateCatalog({ productIds: result.restockedProductIds });
    refresh();
    if (!result.changed) return { ok: true, message: `El pedido ya estaba ${ORDER_STATUS_LABELS[result.status].toLowerCase()}.` };
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
      return { ok: false, error: `El pedido cambió mientras tanto: ahora está ${ORDER_STATUS_LABELS[result.status].toLowerCase()}. Revisa antes de seguir.` };
    case "not_allowed":
      return { ok: false, error: `Un pedido ${ORDER_STATUS_LABELS[result.status].toLowerCase()} no puede pasar a ese estado.` };
    case "payment_in_flight":
      return { ok: false, error: "El pago de este pedido se está procesando. Espera a que se confirme y vuelve a intentarlo." };
    case "payments_unconfigured":
      return { ok: false, error: "Los pagos no están configurados en este servidor: no se puede tocar el pago en Stripe." };
    case "refund_failed":
      return { ok: false, error: "Stripe no hizo el reembolso: el pedido sigue pagado, sin cambios. Inténtalo de nuevo en un rato." };
    case "refund_unknown":
      refresh();
      return {
        ok: false,
        error: "No pudimos confirmar el reembolso con Stripe. Retuvimos el pedido para que no se envíe: reintenta la cancelación en un rato.",
      };
    case "refund_pending":
      refresh();
      return { ok: false, error: "Este pedido tiene un reembolso sin confirmar, así que no se puede enviar. Reintenta la cancelación para cerrarlo." };
    case "no_payment":
      return { ok: false, error: "Este pedido no tiene un pago de Stripe asociado para reembolsar." };
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
  const admin = await requireAdmin({ callbackUrl: "/admin/reviews" });
  const id = idSchema.safeParse(reviewId);
  if (!id.success) return { ok: false, error: "Esa reseña ya no existe." };
  const result = await deleteReview(getDb(), { id: admin.id, role: "ADMIN" }, id.data);
  if (!result.ok) return { ok: false, error: "Esa reseña ya no existe." };
  updateCatalog({ productIds: [result.productId] });
  refresh();
  return { ok: true, message: "Eliminamos la reseña y recalculamos la calificación del producto." };
}
