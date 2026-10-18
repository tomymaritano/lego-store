/*
 * Mercado Pago as the order code sees it: a payment, and the few calls the
 * store makes. Two implementations of MercadoPagoClient:
 * - mercadoPagoApi (./api.ts): the official Node SDK (`mercadopago`) with
 *   MERCADOPAGO_ACCESS_TOKEN (test or production credentials);
 * - mockMercadoPago (./mock.ts): in memory, for the tests and the e2e suite
 *   (PAYMENTS_MOCK=1, never in production; see ../config.ts).
 *
 * Amounts are pesos, as Mercado Pago takes them (decimal amounts; the store's
 * prices are whole pesos). Card data never reaches this server: the Payment
 * Brick turns the card into a single-use token in the browser.
 */

/** Mercado Pago's payment statuses (https://www.mercadopago.com.ar/developers/es/reference/payments/_payments_id/get). */
export type MpPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

/** A payment, with what the store reads from it. */
export interface MpPayment {
  id: string;
  status: MpPaymentStatus | (string & {});
  statusDetail: string | null;
  /** Our order id (we send it as external_reference). */
  externalReference: string | null;
  /** Pesos. */
  amount: number;
  currency: string;
  /** visa, master, rapipago, account_money... */
  paymentMethodId: string | null;
  /** credit_card, debit_card, prepaid_card, ticket, account_money... */
  paymentTypeId: string | null;
  installments: number | null;
  lastFourDigits: string | null;
  /** Cash: the ticket to print or show at the counter. */
  ticketUrl: string | null;
  /** Until when it can be paid (ISO), for tickets. */
  expiresAt: string | null;
  /** Oldest first. A partial refund leaves the payment approved ("partially_refunded"). */
  refunds: MpRefund[];
}

/** A refund of a payment: `amount` pesos, its own status ("approved", "in_process"...). */
export interface MpRefund {
  id: string;
  amount: number;
  status: string | null;
}

/** The payment the store asks for (POST /v1/payments). */
export interface MpPaymentRequest {
  transaction_amount: number;
  description: string;
  payment_method_id: string;
  token?: string;
  installments?: number;
  issuer_id?: number;
  external_reference: string;
  notification_url?: string;
  statement_descriptor?: string;
  metadata?: Record<string, string>;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification?: { type: string; number: string };
  };
}

/** A Checkout Pro preference ("Cuenta de Mercado Pago": the customer pays on Mercado Pago's site). */
export interface MpPreferenceRequest {
  external_reference: string;
  items: { id: string; title: string; quantity: number; unit_price: number; currency_id: "ARS" }[];
  payer: { email: string };
  back_urls: { success: string; pending: string; failure: string };
  auto_return?: "approved";
  notification_url?: string;
  statement_descriptor?: string;
  /** Only account money and Mercado Pago's own options (cards go through the Brick). */
  payment_methods?: { excluded_payment_types?: { id: string }[] };
  expires?: boolean;
  expiration_date_to?: string;
}

export interface MercadoPagoClient {
  /** Creates a payment; the same idempotency key returns the first one. Rejections are payments too (status "rejected"). */
  createPayment(request: MpPaymentRequest, idempotencyKey: string): Promise<MpPayment>;
  /** Null when there is no such payment. */
  getPayment(id: string): Promise<MpPayment | null>;
  cancelPayment(id: string): Promise<MpPayment>;
  /** Refunds the whole payment, or `amount` pesos of it. */
  refundPayment(id: string, options: { idempotencyKey: string; amount?: number }): Promise<{ id: string }>;
  createPreference(request: MpPreferenceRequest): Promise<{ id: string; initPoint: string }>;
  /** Closes a preference now (it can no longer be paid): its total is not the order's any more. */
  expirePreference(id: string): Promise<void>;
}

/**
 * Mercado Pago refused the request itself (a 4xx: an invalid or spent card
 * token, a payment method it does not take), as opposed to a payment it
 * rejected. The customer has to enter the payment again.
 */
export class MercadoPagoRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "MercadoPagoRequestError";
  }
}
