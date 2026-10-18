import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import { STORE_TIME_ZONE } from "@/lib/argentina";
import { subscriberWhere, unsubscribeUrl } from "@/lib/newsletter";
import { ADMIN_ORDER_STATUS_LABELS, cardBrandLabel, formatOrderNumber, paymentMethodTypeLabel } from "@/lib/orders/format";
import { PROVIDER_LABELS } from "@/lib/payments/provider";
import type { AdminOrderFilters } from "@/lib/validations/admin";
import type { AdminSubscriberFilters } from "@/lib/validations/inbox";
import type { AdminUserFilters } from "@/lib/validations/users";
import { recordAudit, type AuditActor } from "./audit";
import { csvStream, type CsvValue } from "./csv";
import { storeDate } from "./format";
import { orderWhere } from "./orders";
import { orderStats, userWhere } from "./users";

/*
 * The admin's CSV exports (Route Handlers under /api/admin/export): orders
 * with one line per product, customers (accounts with what they ordered and
 * spent) and newsletter subscribers, with the same filters as their lists.
 * Each export is counted and recorded in the audit log ("export.<what>",
 * with the filters and the row count) before the first byte goes out, then
 * streamed in batches (src/lib/admin/csv.ts). Client first; the routes
 * check the admin.
 */

export type ExportKind = "orders" | "customers" | "newsletter";

export interface CsvExport {
  filename: string;
  rows: number;
  body: ReadableStream<Uint8Array>;
}

/** Rows read from the database per query while streaming. */
export const EXPORT_BATCH_SIZE = 250;

export interface ExportOptions {
  now?: Date;
  /** Rows per query (EXPORT_BATCH_SIZE); the tests make it small to cross batch boundaries. */
  batchSize?: number;
}

const dateTimeFormat = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: STORE_TIME_ZONE,
});

/** "2026-10-18 14:05" in the store's time zone (Excel reads it as a date). */
export const csvDateTime = (at: Date | null | undefined) => (at ? dateTimeFormat.format(at) : "");

const filename = (kind: string, now: Date) => `${kind}-${storeDate(now)}.csv`;

/** The filters an entry keeps (the empty ones left out). */
const usedFilters = (filters: Record<string, unknown>) =>
  Object.entries(filters)
    .filter(([key, value]) => key !== "page" && value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ") || "ninguno";

async function audit(db: Db, actor: AuditActor, kind: ExportKind, filters: Record<string, unknown>, rows: number) {
  await recordAudit(db, actor, { action: `export.${kind}`, entityType: "export", entityId: kind, changes: { filters: usedFilters(filters), rows } });
}

// ---------------------------------------------------------------------------
// Orders, one line per product
// ---------------------------------------------------------------------------

export const ORDER_EXPORT_HEADER = [
  "Pedido",
  "Fecha",
  "Estado",
  "Email",
  "Nombre",
  "Apellido",
  "Teléfono",
  "Dirección",
  "Ciudad",
  "Provincia",
  "Código postal",
  "País",
  "Proveedor",
  "Medio de pago",
  "Cuotas",
  "Cupón",
  "Subtotal",
  "Descuento",
  "Envío",
  "Total",
  "Producto",
  "ID del producto",
  "Cantidad",
  "Precio unitario",
  "Importe de la línea",
] as const;

const orderSelect = {
  id: true,
  number: true,
  status: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  paymentProvider: true,
  paymentMethodType: true,
  paymentBrand: true,
  installments: true,
  couponCode: true,
  subtotal: true,
  discount: true,
  shipping: true,
  total: true,
  submittedAt: true,
  createdAt: true,
  items: { select: { name: true, productId: true, quantity: true, unitPrice: true }, orderBy: { name: "asc" } },
} as const satisfies Prisma.OrderSelect;

type ExportOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

function orderLines(order: ExportOrder): CsvValue[][] {
  const method = paymentMethodTypeLabel(order.paymentMethodType) ?? (order.paymentBrand ? cardBrandLabel(order.paymentBrand) : "");
  const head: CsvValue[] = [
    formatOrderNumber(order.number),
    csvDateTime(order.submittedAt ?? order.createdAt),
    ADMIN_ORDER_STATUS_LABELS[order.status],
    order.email,
    order.firstName,
    order.lastName,
    order.phone,
    order.address,
    order.city,
    order.state,
    order.zipCode,
    order.country,
    PROVIDER_LABELS[order.paymentProvider],
    method,
    order.installments,
    order.couponCode,
    order.subtotal,
    order.discount,
    order.shipping,
    order.total,
  ];
  if (order.items.length === 0) return [[...head, "", "", "", "", ""]];
  return order.items.map((item) => [...head, item.name, item.productId, item.quantity, item.unitPrice, item.unitPrice * item.quantity]);
}

/** Orders matching the list's filters (status, search, dates), newest first. `rows` counts orders, not lines. */
export async function exportOrders(db: Db, actor: AuditActor, filters: AdminOrderFilters, { now = new Date(), batchSize = EXPORT_BATCH_SIZE }: ExportOptions = {}): Promise<CsvExport> {
  const where = orderWhere(filters);
  const rows = await db.order.count({ where });
  await audit(db, actor, "orders", { ...filters }, rows);
  const body = csvStream<string>(ORDER_EXPORT_HEADER, async (cursor) => {
    const batch = await db.order.findMany({
      where,
      select: orderSelect,
      orderBy: [{ number: "desc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return { lines: batch.flatMap(orderLines), cursor: batch.length === batchSize ? batch.at(-1)!.id : null };
  });
  return { filename: filename("pedidos", now), rows, body };
}

// ---------------------------------------------------------------------------
// Customers (accounts)
// ---------------------------------------------------------------------------

export const CUSTOMER_EXPORT_HEADER = ["ID", "Email", "Nombre", "Rol", "Alta", "Bloqueada", "Pedidos", "Gastado", "Newsletter"] as const;

export async function exportCustomers(db: Db, actor: AuditActor, filters: AdminUserFilters, { now = new Date(), batchSize = EXPORT_BATCH_SIZE }: ExportOptions = {}): Promise<CsvExport> {
  const where = userWhere(filters);
  const rows = await db.user.count({ where });
  await audit(db, actor, "customers", { ...filters }, rows);
  const body = csvStream<string>(CUSTOMER_EXPORT_HEADER, async (cursor) => {
    const batch = await db.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, createdAt: true, blockedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const [stats, subscribed] = await Promise.all([
      orderStats(
        db,
        batch.map((user) => user.id)
      ),
      db.newsletterSubscriber.findMany({ where: { email: { in: batch.map((user) => user.email) }, unsubscribedAt: null }, select: { email: true } }),
    ]);
    const subscribers = new Set(subscribed.map((row) => row.email));
    const lines = batch.map((user): CsvValue[] => {
      const { orders, spent } = stats.get(user.id) ?? { orders: 0, spent: 0 };
      return [user.id, user.email, user.name, user.role === "ADMIN" ? "Admin" : "Cliente", csvDateTime(user.createdAt), user.blockedAt !== null, orders, spent, subscribers.has(user.email)];
    });
    return { lines, cursor: batch.length === batchSize ? batch.at(-1)!.id : null };
  });
  return { filename: filename("clientes", now), rows, body };
}

// ---------------------------------------------------------------------------
// Newsletter subscribers
// ---------------------------------------------------------------------------

/** "Enlace de baja": each active subscriber's own unsubscribe link (lib/newsletter), for a mailing tool's merge field. */
export const NEWSLETTER_EXPORT_HEADER = ["Email", "Estado", "Origen", "Alta", "Baja", "Enlace de baja"] as const;

export async function exportNewsletter(db: Db, actor: AuditActor, filters: AdminSubscriberFilters, { now = new Date(), batchSize = EXPORT_BATCH_SIZE }: ExportOptions = {}): Promise<CsvExport> {
  const where = subscriberWhere(filters);
  const rows = await db.newsletterSubscriber.count({ where });
  await audit(db, actor, "newsletter", { ...filters }, rows);
  const body = csvStream<string>(NEWSLETTER_EXPORT_HEADER, async (cursor) => {
    const batch = await db.newsletterSubscriber.findMany({
      where,
      select: { id: true, email: true, source: true, subscribedAt: true, unsubscribedAt: true },
      orderBy: [{ subscribedAt: "desc" }, { id: "desc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const lines = batch.map((row): CsvValue[] => [
      row.email,
      row.unsubscribedAt ? "De baja" : "Activo",
      row.source,
      csvDateTime(row.subscribedAt),
      csvDateTime(row.unsubscribedAt),
      row.unsubscribedAt ? "" : (unsubscribeUrl(row.id) ?? ""),
    ]);
    return { lines, cursor: batch.length === batchSize ? batch.at(-1)!.id : null };
  });
  return { filename: filename("newsletter", now), rows, body };
}
