import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWishlistStore } from "@/stores/wishlistStore";
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

describe("wishlistStore", () => {
  beforeEach(() => {
    useWishlistStore.setState({ wishlist: [] });
  });

  it("should start with an empty wishlist", () => {
    const { result } = renderHook(() => useWishlistStore());
    expect(result.current.wishlist).toHaveLength(0);
  });

  it("should add item to wishlist", () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.addToWishlist(mockProduct);
    });

    expect(result.current.wishlist).toHaveLength(1);
    expect(result.current.wishlist[0].name).toBe("Test Product");
  });

  it("should not add duplicate items", () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.addToWishlist(mockProduct);
      result.current.addToWishlist(mockProduct);
    });

    expect(result.current.wishlist).toHaveLength(1);
  });

  it("should remove item from wishlist", () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.addToWishlist(mockProduct);
      result.current.removeFromWishlist("1");
    });

    expect(result.current.wishlist).toHaveLength(0);
  });

  it("should clear wishlist", () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.addToWishlist(mockProduct);
      result.current.addToWishlist({ ...mockProduct, id: "2", name: "Product 2" });
      result.current.clearWishlist();
    });

    expect(result.current.wishlist).toHaveLength(0);
  });

  it("should check if item is in wishlist", () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.addToWishlist(mockProduct);
    });

    expect(result.current.isInWishlist("1")).toBe(true);
    expect(result.current.isInWishlist("999")).toBe(false);
  });

  it("should calculate total wishlist quantity", () => {
    const { result } = renderHook(() => useWishlistStore());

    act(() => {
      result.current.addToWishlist(mockProduct);
      result.current.addToWishlist({ ...mockProduct, id: "2" });
      result.current.addToWishlist({ ...mockProduct, id: "3" });
    });

    expect(result.current.getTotalWishlistQuantity()).toBe(3);
  });
});
