import { create } from "zustand";
import type { OrderView } from "@/lib/orders/types";
import type { CheckoutStep, ShippingInfo } from "@/types";

/**
 * Checkout wizard state. In memory only (never persisted). It never holds
 * card data: Stripe's Payment Element and Mercado Pago's Payment Brick keep
 * the card inside their iframes and hand back a token (a Stripe
 * ConfirmationToken, a single-use Mercado Pago card token), which is all that
 * is kept here, with what "Revisar" shows (brand, last 4 digits, installments).
 * Prices and totals come from the server (`order`), not from the cart.
 */

/** Stripe: the card chosen on the payment step, as a ConfirmationToken. */
export interface StripePaymentSummary {
  provider?: "STRIPE";
  confirmationTokenId: string;
  brand: string;
  last4: string;
}

/**
 * Mercado Pago: what the Payment Brick collected (sent to the server only on
 * "Realizar pedido") or "Cuenta de Mercado Pago". `attemptId` identifies this
 * attempt: a retried "Realizar pedido" is the same payment, never a second one.
 */
export interface MercadoPagoPaymentSummary {
  provider: "MERCADOPAGO";
  attemptId: string;
  method: "card" | "ticket" | "wallet";
  /** The Brick's formData (card token, method, installments, payer); none for "wallet". */
  formData?: Record<string, unknown>;
  /** payment_method_id ("visa", "master", "rapipago"…) for the label. */
  brand: string;
  last4: string | null;
  installments: number | null;
}

export type PaymentSummary = StripePaymentSummary | MercadoPagoPaymentSummary;

export const isMercadoPagoPayment = (payment: PaymentSummary): payment is MercadoPagoPaymentSummary => payment.provider === "MERCADOPAGO";

interface CheckoutState {
  currentStep: CheckoutStep;
  shippingInfo: ShippingInfo | null;
  payment: PaymentSummary | null;
  /** Why the last payment did not go through (shown on the payment step). */
  paymentError: string | null;
  /** The server's order: prepared on entering "Revisar", then the placed one. */
  order: OrderView | null;
  /** True from "Realizar pedido" until the payment is accepted or refused. */
  isProcessing: boolean;

  setStep: (step: CheckoutStep) => void;
  setShippingInfo: (info: ShippingInfo) => void;
  setPayment: (payment: PaymentSummary) => void;
  /** A refused payment: back to the payment step with the reason; the token is spent. */
  paymentFailed: (message: string) => void;
  setOrder: (order: OrderView | null) => void;
  setProcessing: (processing: boolean) => void;
  /** The payment was accepted: show the confirmation for this order. */
  orderPlaced: (order: OrderView) => void;
  resetCheckout: () => void;
}

const initialState = {
  currentStep: "shipping" as CheckoutStep,
  shippingInfo: null,
  payment: null,
  paymentError: null,
  order: null,
  isProcessing: false,
};

export const useCheckoutStore = create<CheckoutState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  setShippingInfo: (info) => set({ shippingInfo: info }),
  setPayment: (payment) => set({ payment, paymentError: null }),
  paymentFailed: (message) => set({ payment: null, paymentError: message, isProcessing: false, currentStep: "payment" }),
  setOrder: (order) => set({ order }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  orderPlaced: (order) => set({ order, payment: null, isProcessing: false, currentStep: "confirmation" }),
  resetCheckout: () => set(initialState),
}));
