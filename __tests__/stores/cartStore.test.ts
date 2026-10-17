import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCartCount, useCartStore, useCartSubtotal, useIsInCart } from "@/stores/cartStore";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";
import type { ProductSummary } from "@/types";

const rex: ProductSummary = { id: "1", name: "Captain Rex Helmet", price: 899, img: "/rex.png", stock: 3 };
const leia: ProductSummary = { id: "2", name: "Princess Leia Helmet", price: 649, img: "/leia.png", stock: 10 };

describe("cartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ cart: [] });
  });

  it("starts empty", () => {
    expect(useCartStore.getState().cart).toEqual([]);
  });

  it("adds a line with the summary fields", () => {
    useCartStore.getState().addItem(rex, 2);
    expect(useCartStore.getState().cart).toEqual([
      { id: "1", name: "Captain Rex Helmet", price: 899, image: "/rex.png", quantity: 2, stock: 3 },
    ]);
  });

  it("defaults to one unit and merges repeated adds", () => {
    const { addItem } = useCartStore.getState();
    addItem(leia);
    addItem(leia, 2);
    expect(useCartStore.getState().cart).toHaveLength(1);
    expect(useCartStore.getState().cart[0].quantity).toBe(3);
  });

  it("clamps quantities to the stock", () => {
    const { addItem } = useCartStore.getState();
    addItem(rex, 10);
    expect(useCartStore.getState().cart[0].quantity).toBe(3);
    addItem(rex, 1);
    expect(useCartStore.getState().cart[0].quantity).toBe(3);
  });

  it("ignores out-of-stock products", () => {
    useCartStore.getState().addItem({ ...rex, stock: 0 });
    expect(useCartStore.getState().cart).toEqual([]);
  });

  it("increases and decreases within [1, stock]", () => {
    const { addItem, increaseQuantity, decreaseQuantity } = useCartStore.getState();
    addItem(rex, 1);
    decreaseQuantity("1");
    expect(useCartStore.getState().cart[0].quantity).toBe(1);
    increaseQuantity("1");
    increaseQuantity("1");
    increaseQuantity("1");
    expect(useCartStore.getState().cart[0].quantity).toBe(3);
  });

  it("sets an exact quantity, clamped and rounded", () => {
    const { addItem, setQuantity } = useCartStore.getState();
    addItem(leia, 1);
    setQuantity("2", 4.6);
    expect(useCartStore.getState().cart[0].quantity).toBe(5);
    setQuantity("2", 99);
    expect(useCartStore.getState().cart[0].quantity).toBe(10);
    setQuantity("2", -2);
    expect(useCartStore.getState().cart[0].quantity).toBe(1);
  });

  it("removes a line and clears the cart", () => {
    const { addItem, removeItem, clearCart } = useCartStore.getState();
    addItem(rex);
    addItem(leia);
    removeItem("1");
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["2"]);
    clearCart();
    expect(useCartStore.getState().cart).toEqual([]);
  });

  describe("selectors", () => {
    it("count, subtotal and membership follow the store", () => {
      const count = renderHook(() => useCartCount());
      const subtotal = renderHook(() => useCartSubtotal());
      const inCart = renderHook(() => useIsInCart("1"));
      expect([count.result.current, subtotal.result.current, inCart.result.current]).toEqual([0, 0, false]);

      act(() => {
        useCartStore.getState().addItem(rex, 2);
        useCartStore.getState().addItem(leia, 1);
      });
      count.rerender();
      subtotal.rerender();
      inCart.rerender();
      expect(count.result.current).toBe(3);
      expect(subtotal.result.current).toBe(899 * 2 + 649);
      expect(inCart.result.current).toBe(true);
    });
  });

  describe("persistence", () => {
    it("migrates the unversioned v0 shape and drops malformed lines", async () => {
      localStorage.setItem(
        "lego-cart-storage",
        JSON.stringify({
          state: {
            cart: [
              { id: "1", name: "Rex", price: 899, image: "/rex.png", quantity: 2, stock: 3 },
              { id: "x", name: "Broken" },
              { id: "2", name: "Leia", price: 649, quantity: 1, stock: 5 },
            ],
          },
          version: 0,
        })
      );
      await useCartStore.persist.rehydrate();
      const cart = useCartStore.getState().cart;
      expect(cart.map((l) => l.id)).toEqual(["1", "2"]);
      expect(cart[1].image).toBe(PLACEHOLDER_IMAGE);
      expect(JSON.parse(localStorage.getItem("lego-cart-storage")!).version).toBe(1);
    });
  });
});
