import { describe, it, expect, beforeEach } from "vitest";
import { useCheckoutStore } from "@/stores/checkoutStore";
import { makeOrder } from "../helpers/orders";

const card = { confirmationTokenId: "ctoken_mock_visa", brand: "visa", last4: "4242" };

describe("checkoutStore", () => {
  beforeEach(() => {
    useCheckoutStore.getState().resetCheckout();
  });

  it("keeps the ConfirmationToken and its preview, never card data", () => {
    useCheckoutStore.getState().setPayment(card);
    expect(useCheckoutStore.getState().payment).toEqual(card);
    expect(Object.keys(useCheckoutStore.getState())).not.toContain("cardNumber");
  });

  it("is not persisted", () => {
    useCheckoutStore.getState().setShippingInfo({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "1155555555",
      address: "Calle 123",
      city: "CABA",
      state: "Ciudad Autónoma de Buenos Aires",
      zipCode: "1000",
      country: "Argentina",
    });
    expect(Object.keys(localStorage).some((key) => key.includes("checkout"))).toBe(false);
    expect("persist" in useCheckoutStore).toBe(false);
  });

  it("a refused payment goes back to the payment step with the reason and forgets the spent token", () => {
    const store = useCheckoutStore.getState();
    store.setPayment(card);
    store.setStep("review");
    store.setProcessing(true);
    store.paymentFailed("Tu banco rechazó el pago.");
    expect(useCheckoutStore.getState()).toMatchObject({
      currentStep: "payment",
      payment: null,
      paymentError: "Tu banco rechazó el pago.",
      isProcessing: false,
    });
    store.setPayment(card);
    expect(useCheckoutStore.getState().paymentError).toBeNull();
  });

  it("a placed order moves to the confirmation and drops the token", () => {
    const store = useCheckoutStore.getState();
    store.setPayment(card);
    store.setProcessing(true);
    const order = makeOrder();
    store.orderPlaced(order);
    expect(useCheckoutStore.getState()).toMatchObject({ currentStep: "confirmation", order, payment: null, isProcessing: false });
  });
});
