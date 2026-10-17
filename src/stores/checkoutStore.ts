import { create } from "zustand";
import { detectCardBrand } from "@/lib/card";
import type { CheckoutStep, PaymentInfo, PaymentSummary, ShippingInfo } from "@/types";

/**
 * Checkout wizard state. In memory only (never persisted) and it never holds
 * the card number or the CVV: the payment form keeps those while its step is
 * open and hands over a summary (last 4 digits, name, expiry) on submit.
 */
interface CheckoutState {
  currentStep: CheckoutStep;
  shippingInfo: ShippingInfo | null;
  paymentSummary: PaymentSummary | null;
  orderId: string | null;
  /** Amount charged for the placed order (shown on the confirmation). */
  orderTotal: number | null;
  isProcessing: boolean;

  setStep: (step: CheckoutStep) => void;
  setShippingInfo: (info: ShippingInfo) => void;
  /** Stores only the summary of the card; the full data is dropped here. */
  setPaymentInfo: (info: PaymentInfo) => void;
  /** Mock payment: resolves with the order id and moves to the confirmation. */
  processOrder: (order: { total: number }) => Promise<string>;
  resetCheckout: () => void;
}

export function summarizePayment({ cardNumber, cardName, expiryDate }: PaymentInfo): PaymentSummary {
  return { brand: detectCardBrand(cardNumber), cardName, expiryDate, last4: cardNumber.replace(/\D/g, "").slice(-4) };
}

const ORDER_DELAY_MS = 1200;

const initialState = {
  currentStep: "shipping" as CheckoutStep,
  shippingInfo: null,
  paymentSummary: null,
  orderId: null,
  orderTotal: null,
  isProcessing: false,
};

export const useCheckoutStore = create<CheckoutState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  setShippingInfo: (info) => set({ shippingInfo: info }),

  setPaymentInfo: (info) => set({ paymentSummary: summarizePayment(info) }),

  processOrder: async ({ total }) => {
    set({ isProcessing: true });
    // Mock payment gateway.
    await new Promise((resolve) => setTimeout(resolve, ORDER_DELAY_MS));
    const orderId = `LEGO-${Date.now().toString(36).toUpperCase()}`;
    set({ orderId, orderTotal: total, isProcessing: false, currentStep: "confirmation", paymentSummary: null });
    return orderId;
  },

  resetCheckout: () => set(initialState),
}));
