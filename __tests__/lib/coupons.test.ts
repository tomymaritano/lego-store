import { describe, expect, it } from "vitest";
import { couponStatus } from "@/lib/admin/coupons";
import { couponDateInput, couponWindowLabel } from "@/lib/admin/format";
import {
  couponLabel,
  couponRejection,
  couponRejectionMessage,
  limitRejection,
  normalizeCouponCode,
  windowRejection,
  type CouponRow,
} from "@/lib/coupons/rules";
import { couponCodeSchema } from "@/lib/validations/coupon-code";
import { couponFormSchema, couponQuoteSchema, newCouponCodeSchema, parseCouponFilters } from "@/lib/validations/coupons";
import { prepareMercadoPagoOrderSchema } from "@/lib/validations/orders";

const NOW = new Date("2026-10-18T15:00:00Z");
const row = (overrides: Partial<CouponRow> = {}): CouponRow => ({
  id: "c1",
  code: "BIENVENIDA10",
  type: "PERCENT",
  value: 10,
  minSubtotal: 0,
  startsAt: null,
  expiresAt: null,
  maxRedemptions: null,
  maxPerUser: null,
  active: true,
  ...overrides,
});

/** Intl puts a no-break space between "$" and the amount. */
const spaces = (text: string) => text.replace(/\s/g, " ");

describe("coupon rules", () => {
  it("normalises codes: case-insensitive, trimmed", () => {
    expect(normalizeCouponCode("  bienvenida10 ")).toBe("BIENVENIDA10");
    expect(couponCodeSchema.parse(" lego-500_x ")).toBe("LEGO-500_X");
    for (const bad of ["ab", "con espacio", "ñandú", "X".repeat(33), "100%"]) expect(couponCodeSchema.safeParse(bad).success, bad).toBe(false);
  });

  it("is usable while active and within its dates (start inclusive, end exclusive)", () => {
    expect(windowRejection(row(), NOW)).toBeNull();
    expect(windowRejection(row({ active: false }), NOW)).toBe("inactive");
    expect(windowRejection(row({ startsAt: new Date(NOW.getTime() + 1) }), NOW)).toBe("not_started");
    expect(windowRejection(row({ startsAt: NOW }), NOW)).toBeNull();
    expect(windowRejection(row({ expiresAt: NOW }), NOW)).toBe("expired");
    expect(windowRejection(row({ expiresAt: new Date(NOW.getTime() + 1) }), NOW)).toBeNull();
  });

  it("counts the uses it already has against its limits, in total and per customer", () => {
    expect(limitRejection(row({ maxRedemptions: 3 }), { total: 2, customer: 0 })).toBeNull();
    expect(limitRejection(row({ maxRedemptions: 3 }), { total: 3, customer: 0 })).toBe("exhausted");
    expect(limitRejection(row({ maxPerUser: 1 }), { total: 10, customer: 1 })).toBe("per_customer");
    expect(limitRejection(row({ maxPerUser: 2 }), { total: 10, customer: 1 })).toBeNull();
    // The first reason that applies is the one the customer reads.
    expect(couponRejection(row({ active: false, maxRedemptions: 1 }), { total: 1, customer: 0 }, NOW)).toBe("inactive");
  });

  it("says why in Spanish, with the dates and amounts that matter", () => {
    expect(couponRejectionMessage("not_found")).toMatch(/no existe/);
    // expiresAt is exclusive: the last valid day is the one before (store time zone).
    expect(couponRejectionMessage("expired", { expiresAt: new Date("2026-11-01T03:00:00Z") })).toBe(
      "Este cupón venció: era válido hasta el 31 de octubre de 2026."
    );
    expect(couponRejectionMessage("not_started", { startsAt: new Date("2026-11-01T03:00:00Z") })).toBe(
      "Este cupón todavía no está vigente: puedes usarlo desde el 1 de noviembre de 2026."
    );
    expect(spaces(couponRejectionMessage("min_subtotal", { minSubtotal: 4000 }, 2490))).toBe("Este cupón es para compras desde $ 4.000: te faltan $ 1.510.");
    expect(couponLabel({ type: "PERCENT", value: 15 })).toBe("15% de descuento");
    expect(spaces(couponLabel({ type: "FIXED", value: 500 }))).toBe("$ 500 de descuento");
  });
});

describe("coupon inputs", () => {
  const lines = [{ productId: "7", quantity: 1 }];
  const shipping = {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.com",
    phone: "11 5555 1234",
    address: "Av. Corrientes 1234",
    city: "CABA",
    state: "Ciudad Autónoma de Buenos Aires",
    zipCode: "C1043AAZ",
    country: "Argentina",
  };

  it("the quote and the prepare take a normalised code", () => {
    expect(couponQuoteSchema.parse({ code: "lego500", lines }).code).toBe("LEGO500");
    expect(couponQuoteSchema.safeParse({ code: "lego500", lines: [] }).success).toBe(false);
    expect(prepareMercadoPagoOrderSchema.parse({ shipping, lines, provider: "MERCADOPAGO", couponCode: " lego500" }).couponCode).toBe("LEGO500");
    expect(prepareMercadoPagoOrderSchema.parse({ shipping, lines, provider: "MERCADOPAGO" }).couponCode).toBeUndefined();
  });

  const form = (values: Record<string, unknown> = {}) =>
    couponFormSchema.safeParse({
      code: "",
      description: "",
      type: "PERCENT",
      value: "10",
      minSubtotal: "",
      startsAt: "",
      expiresAt: "",
      maxRedemptions: "",
      maxPerUser: "",
      active: true,
      ...values,
    });
  const errorsOf = (result: ReturnType<typeof form>) =>
    result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));

  it("the admin form: empty limits are no limit, dates are store days (the end day included)", () => {
    const parsed = form({ startsAt: "2026-11-01", expiresAt: "2026-11-30", maxPerUser: "1" });
    expect(parsed.success && parsed.data).toEqual({
      description: "",
      type: "PERCENT",
      value: 10,
      minSubtotal: 0,
      startsAt: new Date("2026-11-01T03:00:00Z"),
      expiresAt: new Date("2026-12-01T03:00:00Z"),
      maxRedemptions: null,
      maxPerUser: 1,
      active: true,
    });
    // A one-day coupon: the same start and end day.
    expect(form({ startsAt: "2026-11-01", expiresAt: "2026-11-01" }).success).toBe(true);
  });

  it("the admin form refuses what the database would", () => {
    expect(errorsOf(form({ value: "0" }))).toHaveProperty("value", "Un porcentaje va de 1 a 100");
    expect(errorsOf(form({ value: "101" }))).toHaveProperty("value");
    expect(errorsOf(form({ value: "" }))).toHaveProperty("value", "Completa el valor del descuento");
    expect(errorsOf(form({ value: "12.5" }))).toHaveProperty("value");
    expect(form({ type: "FIXED", value: "5000" }).success).toBe(true);
    expect(errorsOf(form({ startsAt: "2026-11-02", expiresAt: "2026-11-01" }))).toHaveProperty("expiresAt");
    expect(errorsOf(form({ maxRedemptions: "0" }))).toHaveProperty("maxRedemptions");
    expect(errorsOf(form({ maxRedemptions: "5", maxPerUser: "6" }))).toHaveProperty("maxPerUser", "No puede ser mayor que el límite total");
    expect(errorsOf(form({ minSubtotal: "-1" }))).toHaveProperty("minSubtotal");
    expect(errorsOf(form({ type: "OTHER" }))).toHaveProperty("type");
    expect(newCouponCodeSchema.safeParse("").success).toBe(false);
    expect(newCouponCodeSchema.parse("primavera15")).toBe("PRIMAVERA15");
  });

  it("list filters fall back to no filter", () => {
    expect(parseCouponFilters({ status: "expired", page: "2", q: " lego " })).toEqual({ status: "expired", page: 2, q: "lego" });
    expect(parseCouponFilters({ status: "nope", page: "x" })).toEqual({ status: "", page: 1, q: "" });
  });
});

describe("the admin's coupon status and dates", () => {
  it("off, over, used up, not started, or active", () => {
    expect(couponStatus(row(), 0, NOW)).toBe("active");
    expect(couponStatus(row({ active: false }), 0, NOW)).toBe("inactive");
    expect(couponStatus(row({ expiresAt: NOW }), 0, NOW)).toBe("expired");
    expect(couponStatus(row({ maxRedemptions: 2 }), 2, NOW)).toBe("exhausted");
    expect(couponStatus(row({ startsAt: new Date(NOW.getTime() + 1000) }), 0, NOW)).toBe("scheduled");
  });

  it("shows the validity window by store days, the end day included", () => {
    expect(couponWindowLabel(null, null)).toBe("Sin vencimiento");
    expect(couponWindowLabel("2026-11-01T03:00:00.000Z", "2026-12-01T03:00:00.000Z")).toBe("Del 01/11/2026 al 30/11/2026");
    expect(couponWindowLabel(null, "2026-12-01T03:00:00.000Z")).toBe("Hasta el 30/11/2026");
    expect(couponDateInput("2026-12-01T03:00:00.000Z", "end")).toBe("2026-11-30");
    expect(couponDateInput("2026-11-01T03:00:00.000Z", "start")).toBe("2026-11-01");
  });
});
