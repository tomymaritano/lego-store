import { STORE_TIME_ZONE } from "@/lib/argentina";
import type { CancelReason, OrderStatus, OrderView } from "./types";

/*
 * How orders read to customers (pages and emails). Client-safe.
 */

/** "LEGO-001001": the number customers quote. */
export const formatOrderNumber = (number: number) => `LEGO-${String(number).padStart(6, "0")}`;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pago pendiente",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

/** Badge variant (src/components/ui/Badge) per status. */
export const ORDER_STATUS_BADGE = {
  PENDING: "warning",
  PAID: "success",
  SHIPPED: "new",
  DELIVERED: "neutral",
  CANCELLED: "danger",
} as const satisfies Record<OrderStatus, string>;

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  out_of_stock:
    "Mientras se procesaba el pago se agotó uno de los productos. Cancelamos el pedido y te devolvimos el dinero: puede tardar unos días en verse en tu tarjeta.",
  payment_canceled: "El pago se canceló y no se cobró nada.",
  expired: "El pago no se completó a tiempo, así que cancelamos el pedido. No se cobró nada.",
  superseded: "Lo reemplazó un pedido más nuevo hecho desde el mismo navegador. No se cobró nada.",
  payment_setup_failed: "No pudimos iniciar el pago. No se cobró nada.",
  admin: "La tienda canceló el pedido. Si ya estaba pago, te devolvimos el dinero.",
};

export const cancelReasonLabel = (reason: string | null) =>
  reason && Object.hasOwn(CANCEL_REASON_LABELS, reason) ? CANCEL_REASON_LABELS[reason as CancelReason] : "El pedido se canceló.";

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  cartes_bancaires: "Cartes Bancaires",
};

/** "Visa" for "visa"; unknown brands are capitalised as they come. */
export function cardBrandLabel(brand: string | null | undefined): string {
  if (!brand) return "Tarjeta";
  return BRAND_LABELS[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

/** "Visa •••• 4242" */
export function paymentLabel(brand: string | null | undefined, last4: string | null | undefined): string {
  return last4 ? `${cardBrandLabel(brand)} •••• ${last4}` : cardBrandLabel(brand);
}

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: STORE_TIME_ZONE });
const dateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

/** "17 de octubre de 2026" (store time zone). */
export const formatOrderDate = (iso: string) => dateFormat.format(new Date(iso));
/** "17 oct, 14:05" (store time zone). */
export const formatOrderDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

export interface TimelineStep {
  key: "placed" | "paid" | "shipped" | "delivered" | "cancelled";
  label: string;
  /** When it happened; null while it has not (or never will). */
  at: string | null;
  state: "done" | "current" | "upcoming" | "cancelled";
}

/**
 * The order's progress: placed → paid → shipped → delivered. A cancelled
 * order shows the steps it reached and then "Cancelado" instead of the rest.
 */
export function orderTimeline(order: Pick<OrderView, "status" | "createdAt" | "paidAt" | "shippedAt" | "deliveredAt" | "cancelledAt">): TimelineStep[] {
  const steps: Omit<TimelineStep, "state">[] = [
    { key: "placed", label: "Pedido realizado", at: order.createdAt },
    { key: "paid", label: "Pago confirmado", at: order.paidAt },
    { key: "shipped", label: "Enviado", at: order.shippedAt },
    { key: "delivered", label: "Entregado", at: order.deliveredAt },
  ];
  if (order.status === "CANCELLED") {
    const reached = steps.filter((step) => step.at !== null);
    return [
      ...reached.map((step) => ({ ...step, state: "done" as const })),
      { key: "cancelled", label: "Cancelado", at: order.cancelledAt, state: "cancelled" },
    ];
  }
  const reachedCount = steps.filter((step) => step.at !== null).length;
  return steps.map((step, index) => ({
    ...step,
    state: index < reachedCount - 1 || (index === reachedCount - 1 && order.status === "DELIVERED") ? "done" : index === reachedCount - 1 ? "current" : "upcoming",
  }));
}
