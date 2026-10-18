import type { NormalizedPaymentStatus } from "../provider";
import type { MpPayment, MpRefund } from "./types";

/*
 * Mercado Pago's payment statuses in the store's words, and what to tell the
 * customer about them. Client-safe (pure).
 * https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/payment-brick/payment-submission
 */

export function mapMercadoPagoStatus(status: string, detail?: string | null): NormalizedPaymentStatus {
  switch (status) {
    case "approved":
      // A partial refund leaves it approved ("partially_refunded"): the order stands.
      return "succeeded";
    case "pending":
    case "in_process":
    case "authorized":
    // A dispute opened, not decided yet: nothing changes until it is (refunded / charged_back).
    case "in_mediation":
      return "pending";
    case "rejected":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "charged_back":
      // "reimbursed": the store won the dispute and got the money back. It is
      // not a new approval (the order was cancelled by the chargeback, and a
      // charged-back payment cannot be refunded): only recorded.
      return detail === "reimbursed" ? "chargeback_reversed" : "chargeback";
    default:
      return "pending";
  }
}

/**
 * Where a payment stands for cancelling it (the one classification every
 * cancel path uses: the provider's cancelPayment, the order flow's cleanup):
 * - "settled": it went through, or is disputed (approved, refunded,
 *   charged_back, in_mediation): it cannot be cancelled, it is applied;
 * - "ended": it already ended unpaid (cancelled, rejected);
 * - "cancellable": waiting (pending, in_process, authorized): Mercado Pago can cancel it.
 */
export type MercadoPagoPaymentStage = "settled" | "ended" | "cancellable";

const STAGES: Record<string, MercadoPagoPaymentStage> = {
  approved: "settled",
  refunded: "settled",
  charged_back: "settled",
  in_mediation: "settled",
  cancelled: "ended",
  rejected: "ended",
  pending: "cancellable",
  in_process: "cancellable",
  authorized: "cancellable",
};

/** The payment's stage, or null for a status Mercado Pago does not document. */
export const mercadoPagoPaymentStage = (status: string): MercadoPagoPaymentStage | null => (Object.hasOwn(STAGES, status) ? STAGES[status]! : null);

/**
 * The refund that returned the whole payment, or null when it is not fully
 * refunded (none yet, or only part of it: a partial refund made in Mercado
 * Pago's panel is not the order's refund). The latest refund, the one that
 * completed it.
 */
export function fullRefundOf(payment: MpPayment): MpRefund | null {
  const latest = payment.refunds.at(-1);
  if (!latest) return null;
  const refunded = payment.refunds.filter((refund) => refund.status !== "rejected" && refund.status !== "cancelled").reduce((sum, refund) => sum + refund.amount, 0);
  return payment.status === "refunded" || refunded >= payment.amount ? latest : null;
}

/** Why Mercado Pago rejected a payment, for the customer (tuteo), by status_detail. */
const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Revisa el número de la tarjeta.",
  cc_rejected_bad_filled_date: "Revisa la fecha de vencimiento de la tarjeta.",
  cc_rejected_bad_filled_other: "Revisa los datos de la tarjeta.",
  cc_rejected_bad_filled_security_code: "Revisa el código de seguridad de la tarjeta.",
  cc_rejected_blacklist: "No pudimos procesar tu pago. Prueba con otro medio de pago.",
  cc_rejected_call_for_authorize: "Tu banco pide que autorices el pago. Llámalo para autorizarlo o prueba con otra tarjeta.",
  cc_rejected_card_disabled: "La tarjeta no está activa. Llama a tu banco para activarla o prueba con otra.",
  cc_rejected_card_error: "No pudimos procesar el pago con esa tarjeta. Prueba con otra.",
  cc_rejected_duplicated_payment: "Ya hiciste un pago por ese mismo monto. Si necesitas volver a pagar, usa otra tarjeta u otro medio de pago.",
  cc_rejected_high_risk: "Tu pago fue rechazado. Prueba con otro medio de pago.",
  cc_rejected_insufficient_amount: "La tarjeta no tiene fondos suficientes. Prueba con otra.",
  cc_rejected_invalid_installments: "La tarjeta no acepta esa cantidad de cuotas. Elige otra cantidad.",
  cc_rejected_max_attempts: "Llegaste al límite de intentos con esa tarjeta. Prueba con otra o con otro medio de pago.",
  cc_rejected_other_reason: "Tu banco rechazó el pago. Prueba con otra tarjeta u otro medio de pago.",
  rejected_by_bank: "Tu banco rechazó el pago. Prueba con otra tarjeta u otro medio de pago.",
  rejected_insufficient_data: "Faltan datos para procesar el pago. Revisa el formulario e inténtalo de nuevo.",
};

export const DEFAULT_REJECTION_MESSAGE = "Tu banco rechazó el pago. Prueba con otra tarjeta u otro medio de pago.";

export const rejectionMessage = (detail: string | null | undefined) =>
  detail && Object.hasOwn(REJECTION_MESSAGES, detail) ? REJECTION_MESSAGES[detail]! : DEFAULT_REJECTION_MESSAGE;

/** What a payment waiting to be settled means for the customer, by status_detail. */
export function pendingMessage(methodType: string | null, detail: string | null): string {
  if (methodType === "ticket" || detail === "pending_waiting_payment") {
    return "Generamos tu ticket. Págalo en efectivo antes del vencimiento y te avisamos por email cuando se acredite.";
  }
  if (detail === "pending_review_manual") {
    return "Mercado Pago está revisando tu pago. Te avisamos por email apenas se acredite (suele tardar menos de 2 días hábiles).";
  }
  return "Estamos procesando tu pago. Te avisamos por email apenas se acredite (suele tardar menos de 2 días hábiles).";
}

/** Mercado Pago's statuses as the admin reads them. */
const STATUS_LABELS: Record<string, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  in_process: "En revisión",
  authorized: "Autorizado",
  in_mediation: "En disputa",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Contracargo",
};

/** Mercado Pago's status as the admin reads it; a chargeback the store won says so. */
export const mercadoPagoStatusLabel = (status: string, detail?: string | null) =>
  status === "charged_back" && detail === "reimbursed" ? "Contracargo: disputa ganada" : (STATUS_LABELS[status] ?? status);
