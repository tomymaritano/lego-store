import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCartStore } from "@/stores/cartStore";
import type { Product } from "@/types";

const mockProduct: Product = {
  id: "1",
  name: "Test Product",
  price: 100,
  isNew: false,
  isOnSale: false,
  rating: 4.5,
  category: "helmet",
  type: "Sets",
  age: "18+",
  theme: "Star Wars",
  interests: ["Arte"],
  pieces: "501-1000",
  highlight: "Destacados",
  img: "https://example.com/image.png",
  images: ["https://example.com/image.png"],
  stock: 10,
  shortDescription: "Test description",
  description: "Full test description",
};

describe("cartStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useCartStore.setState({ cart: [] });
  });

  it("should start with an empty cart", () => {
    const { result } = renderHook(() => useCartStore());
    expect(result.current.cart).toHaveLength(0);
  });

  it("should add item to cart", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 2);
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
    expect(result.current.cart[0].name).toBe("Test Product");
  });

  it("should increase quantity for existing item", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 2);
      result.current.addItem(mockProduct, 3);
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(5);
  });

  it("should not exceed stock when adding", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 15); // stock is 10
    });

    expect(result.current.cart[0].quantity).toBe(10);
  });

  it("should remove item from cart", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 1);
      result.current.removeItem("1");
    });

    expect(result.current.cart).toHaveLength(0);
  });

  it("should increase quantity", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 1);
      result.current.increaseQuantity("1");
    });

    expect(result.current.cart[0].quantity).toBe(2);
  });

  it("should not increase quantity beyond stock", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 10);
      result.current.increaseQuantity("1");
    });

    expect(result.current.cart[0].quantity).toBe(10);
  });

  it("should decrease quantity", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 3);
      result.current.decreaseQuantity("1");
    });

    expect(result.current.cart[0].quantity).toBe(2);
  });

  it("should not decrease quantity below 1", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 1);
      result.current.decreaseQuantity("1");
    });

    expect(result.current.cart[0].quantity).toBe(1);
  });

  it("should clear cart", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 1);
      result.current.addItem({ ...mockProduct, id: "2", name: "Product 2" }, 2);
      result.current.clearCart();
    });

    expect(result.current.cart).toHaveLength(0);
  });

  it("should check if item is in cart", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 1);
    });

    expect(result.current.isInCart("1")).toBe(true);
    expect(result.current.isInCart("999")).toBe(false);
  });

  it("should calculate total quantity", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 2);
      result.current.addItem({ ...mockProduct, id: "2" }, 3);
    });

    expect(result.current.getTotalQuantity()).toBe(5);
  });

  it("should calculate total price", () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem(mockProduct, 2); // 100 * 2 = 200
      result.current.addItem({ ...mockProduct, id: "2", price: 50 }, 3); // 50 * 3 = 150
    });

    expect(result.current.getTotalPrice()).toBe(350);
  });
});
