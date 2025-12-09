import { describe, it, expect, beforeEach } from "vitest";
import { useRecentlyViewedStore } from "@/stores/recentlyViewedStore";
import type { Product } from "@/types";

const mockProduct: Product = {
  id: "test-1",
  name: "Test Product",
  price: 999,
  img: "/test.jpg",
  images: ["/test.jpg"],
  theme: "Test Theme",
  category: "helmet",
  rating: 4.5,
  stock: 10,
  description: "A test product",
  age: "18+",
  pieces: 100,
  isNew: false,
  isOnSale: false,
};

const mockProduct2: Product = {
  ...mockProduct,
  id: "test-2",
  name: "Test Product 2",
};

const mockProduct3: Product = {
  ...mockProduct,
  id: "test-3",
  name: "Test Product 3",
};

describe("Recently Viewed Store", () => {
  beforeEach(() => {
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("should add an item to recently viewed", () => {
    const { addItem, getItems } = useRecentlyViewedStore.getState();

    addItem(mockProduct);

    const items = getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("test-1");
  });

  it("should add items to the beginning of the list", () => {
    const { addItem, getItems } = useRecentlyViewedStore.getState();

    addItem(mockProduct);
    addItem(mockProduct2);

    const items = getItems();
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("test-2");
    expect(items[1].id).toBe("test-1");
  });

  it("should not duplicate items, just move to front", () => {
    const { addItem, getItems } = useRecentlyViewedStore.getState();

    addItem(mockProduct);
    addItem(mockProduct2);
    addItem(mockProduct); // Add first product again

    const items = getItems();
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("test-1"); // Should be at front now
    expect(items[1].id).toBe("test-2");
  });

  it("should limit to 10 items maximum", () => {
    const { addItem, getItems } = useRecentlyViewedStore.getState();

    // Add 12 products
    for (let i = 1; i <= 12; i++) {
      addItem({ ...mockProduct, id: `test-${i}`, name: `Product ${i}` });
    }

    const items = getItems();
    expect(items).toHaveLength(10);
    expect(items[0].id).toBe("test-12"); // Most recent
    expect(items[9].id).toBe("test-3"); // Oldest kept
  });

  it("should clear all items", () => {
    const { addItem, clearAll, getItems } = useRecentlyViewedStore.getState();

    addItem(mockProduct);
    addItem(mockProduct2);

    expect(getItems()).toHaveLength(2);

    clearAll();

    expect(getItems()).toHaveLength(0);
  });

  it("should return items via getItems", () => {
    const { addItem, getItems } = useRecentlyViewedStore.getState();

    addItem(mockProduct);
    addItem(mockProduct2);
    addItem(mockProduct3);

    const items = getItems();
    expect(items).toHaveLength(3);
    expect(items.map(i => i.id)).toEqual(["test-3", "test-2", "test-1"]);
  });
});
