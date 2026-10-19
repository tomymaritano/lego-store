import { STORE_TIME_ZONE } from "@/lib/argentina";
import type { CancelReason, OrderStatus, OrderView } from "./types";

/*
 * How orders read to customers (pages and emails). Client-safe.
 */

/** "LEGO-001001": the number customers quote. */
export const formatOrderNumber = (number: number) => `LEGO-${String(number).padStart(6, "0")}`;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pago pendiente",
  PAYMENT_PENDING: "Esperando el pago",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

/**
 * The same statuses for the admin, where both pending ones show side by side
 * (the dashboard, the filters): a checkout nobody paid yet is not a cash
 * ticket (or a card under review) that is out and may still be paid.
 */
export const ADMIN_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ...ORDER_STATUS_LABELS,
  PENDING: "Checkout sin pagar",
  PAYMENT_PENDING: "Pago en curso",
};

/** Badge variant (src/components/ui/Badge) per status. */
export const ORDER_STATUS_BADGE = {
  PENDING: "warning",
  PAYMENT_PENDING: "warning",
  PAID: "success",
  SHIPPED: "new",
  DELIVERED: "neutral",
  CANCELLED: "danger",
} as const satisfies Record<OrderStatus, string>;

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  out_of_stock:
    "Mientras se procesaba el pago se agotó uno de los productos. Cancelamos el pedido y te devolvimos el dinero: puede tardar unos días en verse en tu medio de pago.",
  amount_mismatch:
    "El monto cobrado no coincidía con el total del pedido, así que lo cancelamos y te devolvimos el dinero: puede tardar unos días en verse en tu medio de pago.",
  payment_canceled: "El pago se canceló y no se cobró nada.",
  expired: "El pago no se completó a tiempo, así que cancelamos el pedido. No se cobró nada.",
  superseded: "Lo reemplazó un pedido más nuevo hecho desde el mismo navegador. No se cobró nada.",
  payment_setup_failed: "No pudimos iniciar el pago. No se cobró nada.",
  refunded: "Se reembolsó el pago, así que cancelamos el pedido: el dinero puede tardar unos días en verse en tu medio de pago.",
  late_payment_refunded:
    "El pago llegó cuando el pedido ya estaba cancelado (por ejemplo, un ticket pagado después de su vencimiento), así que te devolvimos el dinero: puede tardar unos días en verse en tu medio de pago.",
  payment_rejected: "El medio de pago rechazó el pago, así que cancelamos el pedido. No se cobró nada.",
  chargeback:
    "Desconociste el pago ante tu banco o tarjeta, así que cancelamos el pedido. Si fue un error, escríbenos.",
  coupon_unavailable:
    "Cuando se acreditó el pago, el cupón del pedido ya no se podía usar (se agotó o venció), así que cancelamos el pedido y te devolvimos lo que hayas pagado. Puedes hacerlo de nuevo sin el cupón.",
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
  // Mercado Pago's payment_method_id values (cards, debit cards, cash).
  master: "Mastercard",
  debvisa: "Visa Débito",
  debmaster: "Mastercard Débito",
  maestro: "Maestro",
  cabal: "Cabal",
  debcabal: "Cabal Débito",
  naranja: "Naranja X",
  tarshop: "Tarjeta Shopping",
  cencosud: "Cencosud",
  argencard: "Argencard",
  cmr: "CMR",
  rapipago: "Rapipago",
  pagofacil: "Pago Fácil",
  account_money: "Dinero en cuenta de Mercado Pago",
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

const METHOD_TYPE_LABELS: Record<string, string> = {
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  prepaid_card: "Tarjeta prepaga",
  ticket: "Efectivo",
  account_money: "Dinero en cuenta de Mercado Pago",
  digital_currency: "Mercado Crédito",
  digital_wallet: "Billetera digital",
};

/** "Tarjeta de crédito" for "credit_card"; null for an unknown or missing type. */
export const paymentMethodTypeLabel = (type: string | null | undefined) => (type && Object.hasOwn(METHOD_TYPE_LABELS, type) ? METHOD_TYPE_LABELS[type]! : null);

const CARD_TYPES = new Set(["credit_card", "debit_card", "prepaid_card"]);

/** Whether a payment type is a card's: only those are paid in installments (cash and account money say 1, meaning nothing). */
export const isCardPaymentType = (type: string | null | undefined) => Boolean(type && CARD_TYPES.has(type));

/** "3 cuotas" / "1 pago". */
export const installmentsLabel = (installments: number) => (installments === 1 ? "1 pago" : `${installments} cuotas`);

/**
 * How an order is paid, in one line: "Visa •••• 4242", "Mastercard •••• 4444
 * · 3 cuotas", "Rapipago (efectivo)", "Dinero en cuenta de Mercado Pago".
 */
export function orderPaymentLabel(order: Pick<OrderView, "paymentBrand" | "paymentLast4" | "payment">): string {
  const { methodType, installments } = order.payment;
  if (methodType === "ticket") return `${cardBrandLabel(order.paymentBrand)} (efectivo)`;
  if (methodType === "account_money") return METHOD_TYPE_LABELS.account_money!;
  if (!order.paymentBrand && !order.paymentLast4) return paymentMethodTypeLabel(methodType) ?? "A confirmar";
  const card = paymentLabel(order.paymentBrand, order.paymentLast4);
  return installments && installments > 1 ? `${card} · ${installmentsLabel(installments)}` : card;
}

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: STORE_TIME_ZONE });
const dateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: STORE_TIME_ZONE,
});

const ticketExpiryFormat = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: STORE_TIME_ZONE,
});

/** "martes 21 de octubre, 23:59" (store time zone): until when a cash ticket can be paid. */
export const formatTicketExpiry = (iso: string) => ticketExpiryFormat.format(new Date(iso));

/** "17 de octubre de 2026" (store time zone). */
export const formatOrderDate = (iso: string) => dateFormat.format(new Date(iso));
/** "17 oct, 14:05" (store time zone). */
export const formatOrderDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/**
 * When the customer placed the order ("Realizar pedido"); its creation time
 * ("Revisar", possibly hours earlier) only for one never submitted.
 */
export const orderPlacedAt = (order: Pick<OrderView, "createdAt" | "submittedAt">) => order.submittedAt ?? order.createdAt;

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
export function orderTimeline(
  order: Pick<OrderView, "status" | "createdAt" | "submittedAt" | "paidAt" | "shippedAt" | "deliveredAt" | "cancelledAt">
): TimelineStep[] {
  const steps: Omit<TimelineStep, "state">[] = [
    { key: "placed", label: "Pedido realizado", at: orderPlacedAt(order) },
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
