import { describe, it, expect } from "vitest";
import { quoteShipping } from "@/lib/shipping";
import { siteConfig } from "@/config/site";

const { freeShippingThreshold, shippingCost } = siteConfig.commerce;

describe("quoteShipping", () => {
  it("charges the flat rate below the threshold and reports what is missing", () => {
    expect(quoteShipping(1000)).toEqual({
      cost: shippingCost,
      free: false,
      remaining: freeShippingThreshold - 1000,
      progress: 1000 / freeShippingThreshold,
    });
  });

  it("is free from the threshold on, with progress capped at 1", () => {
    expect(quoteShipping(freeShippingThreshold)).toMatchObject({ cost: 0, free: true, remaining: 0, progress: 1 });
    expect(quoteShipping(freeShippingThreshold * 3).progress).toBe(1);
  });

  it("costs nothing for an empty cart", () => {
    expect(quoteShipping(0)).toMatchObject({ cost: 0, free: false, remaining: freeShippingThreshold, progress: 0 });
  });
});
