import { beforeEach, describe, expect, it } from "vitest";
import { useCouponStore } from "@/stores/couponStore";

const TERMS = { code: "BIENVENIDA10", type: "PERCENT" as const, value: 10, minSubtotal: 2000, label: "10% de descuento" };
const state = () => useCouponStore.getState();

describe("couponStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCouponStore.setState({ coupon: null, owner: null, checked: null, notice: null });
  });

  it("an applied coupon is confirmed for this page load; removing it can say why", () => {
    state().apply(TERMS, "user-1");
    expect(state()).toMatchObject({ coupon: TERMS, owner: "user-1", checked: "BIENVENIDA10", notice: null });
    state().remove("Quitamos el cupón BIENVENIDA10: venció.");
    expect(state()).toMatchObject({ coupon: null, owner: null, checked: null, notice: "Quitamos el cupón BIENVENIDA10: venció." });
    state().clearNotice();
    expect(state().notice).toBeNull();
  });

  it("follows the session: a visitor's coupon goes into their account; signing out or switching accounts drops it", () => {
    state().apply(TERMS, null);
    state().adoptOwner("user-1");
    expect(state()).toMatchObject({ coupon: TERMS, owner: "user-1" });

    state().adoptOwner("user-2");
    expect(state().coupon).toBeNull();

    state().apply(TERMS, "user-1");
    state().adoptOwner(null);
    expect(state()).toMatchObject({ coupon: null, owner: null });
  });

  it("persists the terms and the owner, never the page's confirmation or notice", async () => {
    state().apply(TERMS, "user-1");
    const saved = JSON.parse(window.localStorage.getItem("lego-coupon-storage") ?? "{}");
    expect(saved).toEqual({ state: { coupon: TERMS, owner: "user-1" }, version: 2 });

    // A new page load reads it back unconfirmed: the cart and the checkout ask the server again.
    useCouponStore.setState({ coupon: null, owner: null, checked: null });
    window.localStorage.setItem("lego-coupon-storage", JSON.stringify(saved));
    await useCouponStore.persist.rehydrate();
    expect(state()).toMatchObject({ coupon: TERMS, owner: "user-1", checked: null });
  });

  it("reads a coupon saved before owners existed as a visitor's", async () => {
    window.localStorage.setItem("lego-coupon-storage", JSON.stringify({ state: { coupon: TERMS }, version: 1 }));
    await useCouponStore.persist.rehydrate();
    expect(state()).toMatchObject({ coupon: TERMS, owner: null });
  });
});
