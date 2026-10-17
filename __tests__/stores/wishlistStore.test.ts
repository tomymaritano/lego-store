import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIsInWishlist, useWishlistCount, useWishlistStore } from "@/stores/wishlistStore";
import type { ProductSummary } from "@/types";

const rex: ProductSummary = { id: "1", name: "Captain Rex Helmet", price: 899, img: "/rex.png", stock: 3 };

describe("wishlistStore", () => {
  beforeEach(() => {
    useWishlistStore.setState({ wishlist: [] });
  });

  it("stores a minimal snapshot", () => {
    useWishlistStore.getState().addToWishlist({ ...rex, extra: "ignored" } as ProductSummary);
    expect(useWishlistStore.getState().wishlist).toEqual([
      { id: "1", name: "Captain Rex Helmet", price: 899, image: "/rex.png", stock: 3 },
    ]);
  });

  it("does not add duplicates", () => {
    const { addToWishlist } = useWishlistStore.getState();
    addToWishlist(rex);
    addToWishlist(rex);
    expect(useWishlistStore.getState().wishlist).toHaveLength(1);
  });

  it("toggles and reports the new state", () => {
    const { toggleWishlist } = useWishlistStore.getState();
    expect(toggleWishlist(rex)).toBe(true);
    expect(toggleWishlist(rex)).toBe(false);
    expect(useWishlistStore.getState().wishlist).toEqual([]);
  });

  it("removes and clears", () => {
    const { addToWishlist, removeFromWishlist, clearWishlist } = useWishlistStore.getState();
    addToWishlist(rex);
    addToWishlist({ ...rex, id: "2" });
    removeFromWishlist("1");
    expect(useWishlistStore.getState().wishlist.map((i) => i.id)).toEqual(["2"]);
    clearWishlist();
    expect(useWishlistStore.getState().wishlist).toEqual([]);
  });

  it("selectors follow the store", () => {
    const count = renderHook(() => useWishlistCount());
    const inWishlist = renderHook(() => useIsInWishlist("1"));
    act(() => useWishlistStore.getState().addToWishlist(rex));
    count.rerender();
    inWishlist.rerender();
    expect(count.result.current).toBe(1);
    expect(inWishlist.result.current).toBe(true);
  });

  it("migrates v0 (with category) to the minimal snapshot", async () => {
    localStorage.setItem(
      "lego-wishlist-storage",
      JSON.stringify({
        state: { wishlist: [{ id: "1", name: "Rex", price: 899, image: "/rex.png", stock: 3, category: "helmet" }, 42] },
        version: 0,
      })
    );
    await useWishlistStore.persist.rehydrate();
    expect(useWishlistStore.getState().wishlist).toEqual([
      { id: "1", name: "Rex", price: 899, image: "/rex.png", stock: 3 },
    ]);
  });
});
