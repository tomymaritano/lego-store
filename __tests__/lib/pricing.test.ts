import { describe, it, expect } from "vitest";
import { FREE_SHIPPING_FROM, SHIPPING_COST, linesSubtotal, orderTotals, quoteShipping } from "@/lib/pricing";
import { siteConfig } from "@/config/site";

describe("quoteShipping", () => {
  it("charges the flat rate below the threshold and reports what is missing", () => {
    expect(quoteShipping(1000)).toEqual({
      cost: SHIPPING_COST,
      free: false,
      remaining: FREE_SHIPPING_FROM - 1000,
      progress: 1000 / FREE_SHIPPING_FROM,
    });
  });

  it("is free from the threshold on, with progress capped at 1", () => {
    expect(quoteShipping(FREE_SHIPPING_FROM)).toMatchObject({ cost: 0, free: true, remaining: 0, progress: 1 });
    expect(quoteShipping(FREE_SHIPPING_FROM * 3).progress).toBe(1);
  });

  it("costs nothing for an empty cart", () => {
    expect(quoteShipping(0)).toMatchObject({ cost: 0, free: false, remaining: FREE_SHIPPING_FROM, progress: 0 });
  });

  it("is the rule the site copy quotes", () => {
    expect(SHIPPING_COST).toBe(299);
    expect(FREE_SHIPPING_FROM).toBe(5000);
    expect(siteConfig.commerce).toMatchObject({ shippingCost: SHIPPING_COST, freeShippingThreshold: FREE_SHIPPING_FROM });
  });
});

describe("orderTotals", () => {
  it("adds shipping below the threshold", () => {
    const lines = [
      { price: 899, quantity: 2 },
      { price: 649, quantity: 1 },
    ];
    expect(linesSubtotal(lines)).toBe(2447);
    expect(orderTotals(lines)).toMatchObject({ subtotal: 2447, total: 2447 + SHIPPING_COST, count: 3 });
  });

  it("ships free from the threshold", () => {
    const totals = orderTotals([{ price: FREE_SHIPPING_FROM, quantity: 1 }]);
    expect(totals.shipping.free).toBe(true);
    expect(totals.total).toBe(FREE_SHIPPING_FROM);
  });

  it("is zero for no lines", () => {
    expect(orderTotals([])).toMatchObject({ subtotal: 0, total: 0, count: 0 });
  });
});
