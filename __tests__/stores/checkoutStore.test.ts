import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { summarizePayment, useCheckoutStore } from "@/stores/checkoutStore";

const card = { cardNumber: "4111 1111 1111 1234", cardName: "Ana Pérez", expiryDate: "12/29", cvv: "987" };

describe("checkoutStore", () => {
  beforeEach(() => {
    useCheckoutStore.getState().resetCheckout();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps only a summary of the card, never the number or the CVV", () => {
    useCheckoutStore.getState().setPaymentInfo(card);
    const state = useCheckoutStore.getState();
    expect(state.paymentSummary).toEqual({ cardName: "Ana Pérez", expiryDate: "12/29", last4: "1234" });
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("4111");
    expect(serialized).not.toContain("987");
  });

  it("summarizes any card format", () => {
    expect(summarizePayment({ ...card, cardNumber: "5555-4444-3333-2222" }).last4).toBe("2222");
  });

  it("is not persisted", () => {
    useCheckoutStore.getState().setShippingInfo({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "1155555555",
      address: "Calle 123",
      city: "CABA",
      state: "CABA",
      zipCode: "1000",
      country: "Argentina",
    });
    expect(Object.keys(localStorage).some((key) => key.includes("checkout"))).toBe(false);
    expect("persist" in useCheckoutStore).toBe(false);
  });

  it("processes the order, moves to confirmation and drops the payment summary", async () => {
    vi.useFakeTimers();
    useCheckoutStore.getState().setPaymentInfo(card);
    const pending = useCheckoutStore.getState().processOrder();
    expect(useCheckoutStore.getState().isProcessing).toBe(true);
    await vi.runAllTimersAsync();
    const orderId = await pending;
    expect(orderId).toMatch(/^LEGO-/);
    expect(useCheckoutStore.getState()).toMatchObject({
      currentStep: "confirmation",
      isProcessing: false,
      orderId,
      paymentSummary: null,
    });
  });
});
