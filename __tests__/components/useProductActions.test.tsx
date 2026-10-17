import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { productActionCopy, useProductActions } from "@/hooks/useProductActions";
import { useCartStore, useCompareStore, useWishlistStore } from "@/stores";
import type { ProductSummary } from "@/types";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  cart: vi.fn(),
  wishlist: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({ showToast: toast, toast: {}, Toaster: () => null }));

const rex: ProductSummary = { id: "1", name: "Captain Rex Helmet", price: 899, img: "/rex.png", stock: 3 };

describe("useProductActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.setState({ cart: [] });
    useWishlistStore.setState({ wishlist: [] });
    useCompareStore.setState({ ids: [] });
  });

  it("adds to the cart with the shared toast copy", () => {
    const { result } = renderHook(() => useProductActions(rex));
    act(() => {
      result.current.addToCart(2);
    });
    expect(result.current.inCart).toBe(true);
    expect(useCartStore.getState().cart[0].quantity).toBe(2);
    expect(toast.cart).toHaveBeenCalledWith(productActionCopy.addedToCart(rex.name, 2));
    expect(productActionCopy.addedToCart(rex.name, 1)).toBe("Captain Rex Helmet agregado al carrito");
  });

  it("refuses out-of-stock products", () => {
    const { result } = renderHook(() => useProductActions({ ...rex, stock: 0 }));
    let added = true;
    act(() => {
      added = result.current.addToCart();
    });
    expect(added).toBe(false);
    expect(result.current.isAvailable).toBe(false);
    expect(useCartStore.getState().cart).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(productActionCopy.outOfStock(rex.name));
  });

  it("removes from the cart", () => {
    useCartStore.getState().addItem(rex);
    const { result } = renderHook(() => useProductActions(rex));
    act(() => result.current.removeFromCart());
    expect(result.current.inCart).toBe(false);
    expect(toast.info).toHaveBeenCalledWith("Captain Rex Helmet eliminado del carrito");
  });

  it("toggles the wishlist", () => {
    const { result } = renderHook(() => useProductActions(rex));
    act(() => {
      result.current.toggleWishlist();
    });
    expect(result.current.inWishlist).toBe(true);
    expect(toast.wishlist).toHaveBeenLastCalledWith("Captain Rex Helmet agregado a favoritos", true);
    act(() => {
      result.current.toggleWishlist();
    });
    expect(result.current.inWishlist).toBe(false);
    expect(toast.wishlist).toHaveBeenLastCalledWith("Captain Rex Helmet eliminado de favoritos", false);
  });

  it("toggles compare and warns when the list is full", () => {
    const { result } = renderHook(() => useProductActions(rex));
    act(() => {
      result.current.toggleCompare();
    });
    expect(result.current.inCompare).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Captain Rex Helmet agregado a la comparación");

    act(() => {
      useCompareStore.setState({ ids: ["2", "3", "4", "5"] });
    });
    let outcome = "";
    act(() => {
      outcome = result.current.toggleCompare();
    });
    expect(outcome).toBe("full");
    expect(toast.warning).toHaveBeenCalledWith("Puedes comparar hasta 4 productos");
  });
});
