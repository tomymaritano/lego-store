import { create } from "zustand";
import type { OrderView } from "@/lib/orders/types";
import type { CheckoutStep, ShippingInfo } from "@/types";

/**
 * Checkout wizard state. In memory only (never persisted). It never holds
 * card data: Stripe's Payment Element keeps the card inside its iframe and
 * hands back a ConfirmationToken, of which only the id, the brand and the
 * last 4 digits are kept here. Prices and totals come from the server
 * (`order`), not from the cart.
 */

/** The card chosen on the payment step, as a ConfirmationToken. */
export interface PaymentSummary {
  confirmationTokenId: string;
  brand: string;
  last4: string;
}

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
