import type { NormalizedPaymentStatus } from "../provider";

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
      return detail === "reimbursed" ? "succeeded" : "chargeback";
    default:
      return "pending";
  }
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
