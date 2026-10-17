import { describe, it, expect } from "vitest";
import { compareValue, differingRows } from "@/lib/compare";
import type { Product } from "@/types";

const base: Product = {
  id: "1",
  name: "A",
  price: 899,
  isNew: false,
  isOnSale: false,
  rating: 4.5,
  category: "helmet",
  type: "Set",
  age: "18+",
  theme: "Star Wars",
  interests: [],
  pieces: "501-1000",
  highlight: "",
  img: "/a.png",
  images: [],
  stock: 5,
  shortDescription: "",
  description: "",
};

describe("compare rows", () => {
  it("finds no differences with fewer than two products", () => {
    expect(differingRows([base]).size).toBe(0);
  });

  it("flags only the rows whose values differ", () => {
    const other = { ...base, id: "2", price: 649, theme: "Marvel", stock: 1 };
    expect([...differingRows([base, other])].sort()).toEqual(["price", "theme"]);
  });

  it("compares availability, not the exact stock", () => {
    expect(compareValue({ ...base, stock: 3 }, "availability")).toBe(compareValue(base, "availability"));
    const soldOut = { ...base, id: "2", stock: 0 };
    expect(differingRows([base, soldOut]).has("availability")).toBe(true);
  });
});
