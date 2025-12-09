import { create } from "zustand";

export interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface PaymentInfo {
  cardNumber: string;
  cardName: string;
  expiryDate: string;
  cvv: string;
}

export type CheckoutStep = "shipping" | "payment" | "review" | "confirmation";

interface CheckoutState {
  currentStep: CheckoutStep;
  shippingInfo: ShippingInfo | null;
  paymentInfo: PaymentInfo | null;
  orderId: string | null;
  isProcessing: boolean;

  setStep: (step: CheckoutStep) => void;
  setShippingInfo: (info: ShippingInfo) => void;
  setPaymentInfo: (info: PaymentInfo) => void;
  processOrder: () => Promise<string>;
  resetCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  currentStep: "shipping",
  shippingInfo: null,
  paymentInfo: null,
  orderId: null,
  isProcessing: false,

  setStep: (step) => set({ currentStep: step }),

  setShippingInfo: (info) => set({ shippingInfo: info }),

  setPaymentInfo: (info) => set({ paymentInfo: info }),

  processOrder: async () => {
    set({ isProcessing: true });

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate order ID
    const orderId = `LEGO-${Date.now().toString(36).toUpperCase()}`;

    set({
      orderId,
      isProcessing: false,
      currentStep: "confirmation",
    });

    return orderId;
  },

  resetCheckout: () =>
    set({
      currentStep: "shipping",
      shippingInfo: null,
      paymentInfo: null,
      orderId: null,
      isProcessing: false,
    }),
}));
