import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHIPPING_RULES,
  couponDiscount,
  linesSubtotal,
  orderTotals,
  percentOf,
  quoteShipping,
  totalsFor,
} from "@/lib/pricing";

const RULES = DEFAULT_SHIPPING_RULES;
const SHIPPING_COST = RULES.cost;
const FREE_SHIPPING_FROM = RULES.freeFrom;

describe("quoteShipping", () => {
  it("charges the flat rate below the threshold and reports what is missing", () => {
    expect(quoteShipping(1000, RULES)).toEqual({
      cost: SHIPPING_COST,
      free: false,
      remaining: FREE_SHIPPING_FROM - 1000,
      progress: 1000 / FREE_SHIPPING_FROM,
    });
  });

  it("is free from the threshold on, with progress capped at 1", () => {
    expect(quoteShipping(FREE_SHIPPING_FROM, RULES)).toMatchObject({ cost: 0, free: true, remaining: 0, progress: 1 });
    expect(quoteShipping(FREE_SHIPPING_FROM * 3, RULES).progress).toBe(1);
  });

  it("costs nothing for an empty cart", () => {
    expect(quoteShipping(0, RULES)).toMatchObject({ cost: 0, free: false, remaining: FREE_SHIPPING_FROM, progress: 0 });
  });

  it("starts a new store at $299, free from $5.000", () => {
    expect(DEFAULT_SHIPPING_RULES).toEqual({ cost: 299, freeFrom: 5000 });
  });

  it("follows the store's own rule", () => {
    const rules = { cost: 450, freeFrom: 8000 };
    expect(quoteShipping(5000, rules)).toEqual({ cost: 450, free: false, remaining: 3000, progress: 5000 / 8000 });
    expect(quoteShipping(8000, rules)).toMatchObject({ cost: 0, free: true });
    expect(orderTotals([{ price: 5000, quantity: 1 }], rules)).toMatchObject({ shipping: { cost: 450 }, total: 5450 });
  });
});

describe("orderTotals", () => {
  it("adds shipping below the threshold", () => {
    const lines = [
      { price: 899, quantity: 2 },
      { price: 649, quantity: 1 },
    ];
    expect(linesSubtotal(lines)).toBe(2447);
    expect(orderTotals(lines, RULES)).toMatchObject({ subtotal: 2447, total: 2447 + SHIPPING_COST, count: 3 });
  });

  it("ships free from the threshold", () => {
    const totals = orderTotals([{ price: FREE_SHIPPING_FROM, quantity: 1 }], RULES);
    expect(totals.shipping.free).toBe(true);
    expect(totals.total).toBe(FREE_SHIPPING_FROM);
  });

  it("is zero for no lines", () => {
    expect(orderTotals([], RULES)).toMatchObject({ subtotal: 0, discount: 0, total: 0, count: 0, coupon: null });
  });
});

describe("coupon discounts", () => {
  const percent = (value: number, minSubtotal = 0) => ({ code: "P", type: "PERCENT" as const, value, minSubtotal });
  const fixed = (value: number, minSubtotal = 0) => ({ code: "F", type: "FIXED" as const, value, minSubtotal });

  it("rounds a percentage to whole pesos, half up, with integer math", () => {
    expect(percentOf(2445, 10)).toBe(245); // 244.5 → 245
    expect(percentOf(2444, 10)).toBe(244); // 244.4 → 244
    expect(percentOf(2679, 10)).toBe(268); // 267.9 → 268
    expect(percentOf(333, 15)).toBe(50); // 49.95 → 50
    expect(percentOf(1, 1)).toBe(0); // 0.01 → 0
    expect(couponDiscount(2445, percent(10))).toBe(245);
    expect(couponDiscount(1000, percent(100))).toBe(1000);
  });

  it("caps a fixed amount at the subtotal", () => {
    expect(couponDiscount(2490, fixed(500))).toBe(500);
    expect(couponDiscount(300, fixed(500))).toBe(300);
  });

  it("takes nothing below the minimum subtotal, without a coupon, or from an empty cart", () => {
    expect(couponDiscount(3999, fixed(500, 4000))).toBe(0);
    expect(couponDiscount(4000, fixed(500, 4000))).toBe(500);
    expect(couponDiscount(2000, null)).toBe(0);
    expect(couponDiscount(0, percent(10))).toBe(0);
  });

  it("takes the discount off the products, never off shipping", () => {
    const totals = orderTotals([{ price: 2490, quantity: 1 }], RULES, percent(10));
    expect(totals).toMatchObject({ subtotal: 2490, discount: 249, total: 2490 - 249 + SHIPPING_COST, coupon: { code: "P", applies: true, shortBy: 0 } });
    expect(totals.shipping.cost).toBe(SHIPPING_COST);
  });

  it("decides free shipping before the discount: a coupon never brings shipping back", () => {
    const totals = orderTotals([{ price: FREE_SHIPPING_FROM, quantity: 1 }], RULES, percent(20));
    expect(totals).toMatchObject({ discount: 1000, shipping: { cost: 0, free: true }, total: FREE_SHIPPING_FROM - 1000 });
  });

  it("charges shipping when the coupon covers every product: an order is never free", () => {
    expect(orderTotals([{ price: 6000, quantity: 1 }], RULES, fixed(100_000))).toMatchObject({
      discount: 6000,
      shipping: { cost: SHIPPING_COST, free: false },
      total: SHIPPING_COST,
    });
    expect(orderTotals([{ price: 1000, quantity: 1 }], RULES, percent(100)).total).toBe(SHIPPING_COST);
  });

  it("keeps a coupon below its minimum, says what is missing, and prices without it", () => {
    const totals = orderTotals([{ price: 2490, quantity: 1 }], RULES, fixed(500, 4000));
    expect(totals).toMatchObject({ discount: 0, total: 2490 + SHIPPING_COST, coupon: { applies: false, shortBy: 1510 } });
    expect(totalsFor(2490, 1, RULES, null).coupon).toBeNull();
  });
});
