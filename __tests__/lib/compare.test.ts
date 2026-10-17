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
  reviewCount: 4,
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
    const other = { ...base, id: "2", price: 649, theme: "Marvel" };
    expect([...differingRows([base, other])].sort()).toEqual(["price", "theme"]);
  });

  it("compares the stock count the availability cell shows", () => {
    expect(differingRows([base, { ...base, id: "2", stock: 3 }]).has("availability")).toBe(true);
    expect(differingRows([base, { ...base, id: "2" }]).has("availability")).toBe(false);
    expect(differingRows([base, { ...base, id: "2", stock: 0 }]).has("availability")).toBe(true);
    expect(compareValue({ ...base, stock: -1 }, "availability")).toBe(compareValue({ ...base, stock: 0 }, "availability"));
  });
});
