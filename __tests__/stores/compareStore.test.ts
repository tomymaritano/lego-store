import { describe, it, expect, beforeEach } from "vitest";
import { useCompareStore } from "@/stores/compareStore";
import type { Product } from "@/types";

const mockProduct: Product = {
  id: "test-1",
  name: "Test Product 1",
  price: 100,
  category: "test",
  theme: "Test Theme",
  img: "/test.jpg",
  images: ["/test.jpg"],
  description: "Test description",
  age: "18+",
  pieces: 100,
  rating: 4.5,
  stock: 10,
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

const mockProduct4: Product = {
  ...mockProduct,
  id: "test-4",
  name: "Test Product 4",
};

const mockProduct5: Product = {
  ...mockProduct,
  id: "test-5",
  name: "Test Product 5",
};

describe("Compare Store", () => {
  beforeEach(() => {
    useCompareStore.setState({ items: [] });
  });

  it("should start with an empty compare list", () => {
    const { items } = useCompareStore.getState();
    expect(items).toHaveLength(0);
  });

  it("should add a product to compare", () => {
    const { addToCompare } = useCompareStore.getState();

    const result = addToCompare(mockProduct);

    expect(result).toBe(true);
    expect(useCompareStore.getState().items).toHaveLength(1);
    expect(useCompareStore.getState().items[0].id).toBe("test-1");
  });

  it("should not add duplicate products", () => {
    const { addToCompare } = useCompareStore.getState();

    addToCompare(mockProduct);
    const result = addToCompare(mockProduct);

    expect(result).toBe(false);
    expect(useCompareStore.getState().items).toHaveLength(1);
  });

  it("should not add more than 4 products", () => {
    const { addToCompare } = useCompareStore.getState();

    addToCompare(mockProduct);
    addToCompare(mockProduct2);
    addToCompare(mockProduct3);
    addToCompare(mockProduct4);
    const result = addToCompare(mockProduct5);

    expect(result).toBe(false);
    expect(useCompareStore.getState().items).toHaveLength(4);
  });

  it("should remove a product from compare", () => {
    const { addToCompare, removeFromCompare } = useCompareStore.getState();

    addToCompare(mockProduct);
    addToCompare(mockProduct2);
    removeFromCompare(mockProduct.id);

    const { items } = useCompareStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("test-2");
  });

  it("should clear all compare items", () => {
    const { addToCompare, clearCompare } = useCompareStore.getState();

    addToCompare(mockProduct);
    addToCompare(mockProduct2);
    clearCompare();

    expect(useCompareStore.getState().items).toHaveLength(0);
  });

  it("should correctly check if product is in compare", () => {
    const { addToCompare, isInCompare } = useCompareStore.getState();

    addToCompare(mockProduct);

    expect(isInCompare(mockProduct.id)).toBe(true);
    expect(isInCompare(mockProduct2.id)).toBe(false);
  });

  it("should correctly check if can add more products", () => {
    const { addToCompare, canAddMore } = useCompareStore.getState();

    expect(canAddMore()).toBe(true);

    addToCompare(mockProduct);
    addToCompare(mockProduct2);
    addToCompare(mockProduct3);

    expect(canAddMore()).toBe(true);

    addToCompare(mockProduct4);

    expect(canAddMore()).toBe(false);
  });
});
