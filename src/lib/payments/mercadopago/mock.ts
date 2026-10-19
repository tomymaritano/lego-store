import { randomInt } from "node:crypto";
import { MP_MOCK_TICKETS, mpMockCardOf } from "./mock-options";
import { MercadoPagoRequestError, type MercadoPagoClient, type MpPayment, type MpPreferenceRequest } from "./types";

/*
 * An in-memory MercadoPagoClient: what the integration tests and the e2e
 * suite use instead of Mercado Pago's API (../config.ts only enables it
 * outside production, with PAYMENTS_MOCK=1). It behaves like Mercado Pago
 * where the order code depends on it: the same idempotency key returns the
 * first payment, rejections are payments with status "rejected", cash
 * payments start pending with a ticket, only pending payments can be
 * cancelled, and refunds are idempotent and turn the payment "refunded".
 *
 * Nothing happens by itself: what Mercado Pago would do later (a ticket paid
 * at the counter, a review approved, a chargeback) the test does with
 * mockMercadoPagoControls and then sends the signed notification, as
 * Mercado Pago would. The e2e suite reaches these controls through
 * /api/test/mercadopago (mock mode only).
 */

interface MockPreference {
  id: string;
  request: MpPreferenceRequest;
  /** Closed with expirePreference: it can no longer be paid. */
  expired: boolean;
}

export interface MockMercadoPagoState {
  payments: Map<string, MpPayment>;
  /** idempotency key -> payment or refund id */
  keys: Map<string, string>;
  preferences: Map<string, MockPreference>;
}

export function createMockMercadoPagoState(): MockMercadoPagoState {
  return { payments: new Map(), keys: new Map(), preferences: new Map() };
}

/** Mercado Pago's ids are numbers; these look like them. */
const newId = () => String(randomInt(100_000_000, 999_999_999)) + String(randomInt(100, 999));

const TICKET_DAYS = 3;

export function mockMercadoPago(state: MockMercadoPagoState = createMockMercadoPagoState()): MercadoPagoClient {
  const payment = (id: string) => {
    const found = state.payments.get(id);
    if (!found) throw new MercadoPagoRequestError(`Payment not found: ${id}`, 404);
    return found;
  };
  const copy = (value: MpPayment): MpPayment => ({ ...value, refunds: value.refunds.map((refund) => ({ ...refund })) });

  return {
    async createPayment(request, idempotencyKey) {
      const existing = state.keys.get(idempotencyKey);
      if (existing) return copy(payment(existing));

      const base = {
        id: newId(),
        externalReference: request.external_reference,
        amount: request.transaction_amount,
        currency: "ARS",
        paymentMethodId: request.payment_method_id,
        refunds: [],
      };
      let created: MpPayment;
      if (Object.hasOwn(MP_MOCK_TICKETS, request.payment_method_id)) {
        created = {
          ...base,
          status: "pending",
          statusDetail: "pending_waiting_payment",
          paymentTypeId: "ticket",
          installments: 1,
          lastFourDigits: null,
          ticketUrl: `https://www.mercadopago.com.ar/sandbox/payments/${base.id}/ticket?mock=1`,
          expiresAt: new Date(Date.now() + TICKET_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        };
      } else {
        const card = mpMockCardOf(request.token);
        // A token Mercado Pago does not know (or spent): it refuses the request itself.
        if (!card) throw new MercadoPagoRequestError("Invalid card token", 400);
        created = {
          ...base,
          status: card.status,
          statusDetail: card.detail,
          paymentMethodId: card.paymentMethodId,
          paymentTypeId: card.paymentTypeId,
          installments: request.installments ?? card.installments,
          lastFourDigits: card.last4,
          ticketUrl: null,
          expiresAt: null,
        };
      }
      state.payments.set(created.id, created);
      state.keys.set(idempotencyKey, created.id);
      return copy(created);
    },

    async getPayment(id) {
      const found = state.payments.get(id);
      return found ? copy(found) : null;
    },

    async cancelPayment(id) {
      const current = payment(id);
      if (!["pending", "in_process", "authorized"].includes(current.status)) {
        throw new MercadoPagoRequestError(`Payment ${id} cannot be cancelled: it is ${current.status}`, 400);
      }
      current.status = "cancelled";
      current.statusDetail = "by_collector";
      return copy(current);
    },

    async refundPayment(id, { idempotencyKey, amount }) {
      const existing = state.keys.get(idempotencyKey);
      if (existing) return { id: existing };
      const current = payment(id);
      if (current.status !== "approved") throw new MercadoPagoRequestError(`Payment ${id} cannot be refunded: it is ${current.status}`, 400);
      const refundId = newId();
      const left = current.amount - current.refunds.reduce((sum, refund) => sum + refund.amount, 0);
      // Without an amount, Mercado Pago refunds what is left of the payment.
      const partial = amount !== undefined && amount < left;
      current.refunds.push({ id: refundId, amount: amount ?? left, status: "approved" });
      current.status = partial ? "approved" : "refunded";
      current.statusDetail = partial ? "partially_refunded" : "refunded";
      state.keys.set(idempotencyKey, refundId);
      return { id: refundId };
    },

    async createPreference(request) {
      const id = `pref_mock_${newId()}`;
      state.preferences.set(id, { id, request, expired: false });
      // There is no Mercado Pago site to go to: the customer "comes back" at once, still unpaid.
      const back = new URL(request.back_urls.pending);
      back.searchParams.set("preference_id", id);
      return { id, initPoint: back.toString() };
    },

    async expirePreference(id) {
      const preference = state.preferences.get(id);
      if (!preference) throw new MercadoPagoRequestError(`Preference not found: ${id}`, 404);
      preference.expired = true;
    },
  };
}

/** What Mercado Pago would do later on its own, for the tests to trigger. */
export function mockMercadoPagoControls(state: MockMercadoPagoState) {
  return {
    /** A payment changes status (a ticket paid, a review decided, a chargeback...). */
    setStatus(id: string, status: string, statusDetail: string | null = null): MpPayment {
      const current = state.payments.get(id);
      if (!current) throw new Error(`No mock payment ${id}`);
      current.status = status;
      current.statusDetail = statusDetail;
      return { ...current };
    },
    /**
     * The customer pays a Checkout Pro preference with account money: a new
     * approved payment. `force` pays one that was expired (a payment that was
     * already under way when it closed).
     */
    payPreference(preferenceId: string, { force = false }: { force?: boolean } = {}): MpPayment {
      const preference = state.preferences.get(preferenceId);
      if (!preference) throw new Error(`No mock preference ${preferenceId}`);
      if (preference.expired && !force) throw new Error(`Mock preference ${preferenceId} expired`);
      const amount = preference.request.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const created: MpPayment = {
        id: newId(),
        status: "approved",
        statusDetail: "accredited",
        externalReference: preference.request.external_reference,
        amount,
        currency: "ARS",
        paymentMethodId: "account_money",
        paymentTypeId: "account_money",
        installments: 1,
        lastFourDigits: null,
        ticketUrl: null,
        expiresAt: null,
        refunds: [],
      };
      state.payments.set(created.id, created);
      return { ...created };
    },
    /** Creates a payment as if made elsewhere (a stray second payment of the same order, say). */
    addPayment(payment: MpPayment): MpPayment {
      state.payments.set(payment.id, payment);
      return { ...payment };
    },
    get(id: string): MpPayment | null {
      return state.payments.get(id) ?? null;
    },
    preference(id: string) {
      return state.preferences.get(id) ?? null;
    },
  };
}
