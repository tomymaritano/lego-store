import { STORE_TIME_ZONE } from "@/lib/argentina";
import type { CancelReason, OrderStatus } from "@/lib/orders/types";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";

/*
 * What the admin panel's server code and its pages share. Client-safe.
 */

/** Stock at or under this counts as low (the dashboard lists them, sold out first). */
export const LOW_STOCK = 5;

/** One page of a paginated admin list. `page` is clamped to the pages that exist. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export const pageCount = (total: number, size = ADMIN_PAGE_SIZE) => Math.max(1, Math.ceil(total / size));

/**
 * The status changes an admin can make, from each status (design doc,
 * "Cambios de estado del admin"). Shipped and delivered orders cannot be
 * cancelled; PENDING -> PAID is only ever the webhook's (a real payment).
 * PAYMENT_PENDING (Mercado Pago: a ticket not paid yet, a card under review)
 * can be cancelled: its payment is cancelled with the provider first.
 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, readonly ("SHIPPED" | "DELIVERED" | "CANCELLED")[]> = {
  PENDING: ["CANCELLED"],
  PAYMENT_PENDING: ["CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) =>
  (ADMIN_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The store's calendar date of an instant, "2026-10-18". */
export const storeDate = (at: Date) => dayFormat.format(at);

/**
 * When a store calendar date ("2026-10-18") starts, as an instant. Argentina
 * keeps UTC-3 all year (no daylight saving since 2009), so the offset is fixed.
 */
export const storeDayStart = (date: string) => new Date(`${date}T00:00:00-03:00`);

/** The instant the next store day starts (an exclusive upper bound for `date`). */
export function storeDayEnd(date: string): Date {
  const start = storeDayStart(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

const adminDateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: STORE_TIME_ZONE,
});

/**
 * "18/01/2024, 14:05" (store time zone), on purpose numeric: the admin's
 * tables and order pages span years of orders and are scanned in columns, so
 * every admin date (the order page's timeline included) has the year and the
 * same width. The customer's pages use words ("18 de octubre de 2026").
 */
export const formatAdminDateTime = (iso: string) => adminDateTimeFormat.format(new Date(iso));

const ADMIN_CANCEL_REASONS: Record<Exclude<CancelReason, "admin">, string> = {
  out_of_stock: "Se agotó un producto mientras se procesaba el pago; se reembolsó automáticamente.",
  amount_mismatch: "El proveedor de pagos cobró un monto distinto del total del pedido; se reembolsó automáticamente.",
  payment_canceled: "El pago se canceló en el proveedor antes de cobrarse; no se cobró nada.",
  expired: "El pago no se completó a tiempo (o venció el ticket) y el pedido se canceló; no se cobró nada.",
  superseded: "Lo reemplazó un pedido más nuevo del mismo navegador; no se cobró nada.",
  payment_setup_failed: "No se pudo crear el pago en el proveedor; no se cobró nada.",
  refunded: "El pago se reembolsó desde el proveedor (fuera del panel), así que el pedido se canceló.",
  late_payment_refunded:
    "El pago se acreditó cuando el pedido ya estaba cancelado (por ejemplo, un ticket pagado después de vencer); la tienda lo reembolsó automáticamente.",
  payment_rejected: "El pago quedó en revisión y después fue rechazado; no se cobró nada.",
  chargeback: "El cliente desconoció el pago (contracargo); se devolvió el stock.",
};

/**
 * Why an order was cancelled, as the admin reads it: what happened, not the
 * customer's "te devolvimos el dinero". An admin's own cancellation says
 * whether it refunded a payment (it then has a refund id) or came before any.
 */
export function adminCancelReasonLabel(reason: string | null, refundId: string | null): string {
  if (reason === "admin") return refundId ? "Cancelado por un admin; se reembolsó el pago." : "Cancelado por un admin antes del pago; no se cobró nada.";
  return reason && Object.hasOwn(ADMIN_CANCEL_REASONS, reason) ? ADMIN_CANCEL_REASONS[reason as keyof typeof ADMIN_CANCEL_REASONS] : "Se canceló el pedido.";
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export const COUPON_STATUS_LABELS = {
  active: "Activo",
  scheduled: "Programado",
  expired: "Vencido",
  exhausted: "Agotado",
  inactive: "Desactivado",
} as const;

export const COUPON_STATUS_BADGE = {
  active: "success",
  scheduled: "neutral",
  expired: "neutral",
  exhausted: "warning",
  inactive: "neutral",
} as const;

export const REDEMPTION_STATUS_LABELS = {
  RESERVED: "Reservado",
  REDEEMED: "Usado",
  RELEASED: "Liberado",
} as const;

export const REDEMPTION_STATUS_BADGE = {
  RESERVED: "warning",
  REDEEMED: "success",
  RELEASED: "neutral",
} as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "coupon.create": "Creó el cupón",
  "coupon.update": "Editó el cupón",
  "coupon.activate": "Activó el cupón",
  "coupon.deactivate": "Desactivó el cupón",
};

/** The coupon fields an audit entry can name, as the admin reads them. */
export const COUPON_FIELD_LABELS: Record<string, string> = {
  code: "código",
  description: "nota",
  type: "tipo",
  value: "valor",
  minSubtotal: "compra mínima",
  startsAt: "válido desde",
  expiresAt: "vence",
  maxRedemptions: "límite total",
  maxPerUser: "límite por cliente",
  active: "activo",
};

const adminDateFormat = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: STORE_TIME_ZONE });

/** "18/01/2024" (store time zone). */
export const formatAdminDate = (iso: string) => adminDateFormat.format(new Date(iso));

/** A coupon's validity window: "Desde 01/11/2026 · hasta 31/12/2026" (expiresAt is exclusive: its last day is the one before). */
export function couponWindowLabel(startsAt: string | null, expiresAt: string | null): string {
  const lastDay = expiresAt ? formatAdminDate(new Date(new Date(expiresAt).getTime() - 1).toISOString()) : null;
  if (startsAt && lastDay) return `Del ${formatAdminDate(startsAt)} al ${lastDay}`;
  if (startsAt) return `Desde el ${formatAdminDate(startsAt)}`;
  if (lastDay) return `Hasta el ${lastDay}`;
  return "Sin vencimiento";
}

/** The store day a coupon's date falls on, for a date input ("2026-12-31"); expiresAt gives its last valid day. */
export function couponDateInput(iso: string | null, kind: "start" | "end"): string {
  if (!iso) return "";
  const at = new Date(iso);
  return storeDate(kind === "end" ? new Date(at.getTime() - 1) : at);
}
