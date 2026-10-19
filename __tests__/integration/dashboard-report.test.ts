import { beforeAll, describe, expect, it } from "vitest";
import { getDashboardReport } from "@/lib/admin/report";
import { resetDatabase, testDb } from "./setup/db";

/*
 * The dashboard's report against the test database, with orders written at
 * known instants: revenue by the store day it was paid (Argentina, UTC-3),
 * only what the store kept, top products, revenue by payment method, coupon
 * usage and the conversion proxy.
 */

const NOW = new Date("2026-10-18T15:00:00Z"); // 12:00 in Buenos Aires
const at = (iso: string) => new Date(iso);

let n = 0;
async function order(
  status: "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "PENDING",
  paidAt: Date | null,
  lines: { productId: string; name: string; unitPrice: number; quantity: number }[],
  extra: Record<string, unknown> = {}
) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const id = `report-${++n}`;
  await testDb.order.create({
    data: {
      id,
      email: `cliente${n}@report.test`,
      status,
      firstName: "Ana",
      lastName: "Prueba",
      phone: "1155550000",
      address: "Calle 1",
      city: "CABA",
      state: "CABA",
      zipCode: "1000",
      country: "Argentina",
      subtotal,
      shipping: 0,
      total: subtotal,
      paymentProvider: "MERCADOPAGO",
      paymentMethodType: "credit_card",
      createdAt: paidAt ?? at("2026-10-17T12:00:00Z"),
      submittedAt: paidAt,
      paidAt,
      ...extra,
      items: { create: lines.map((line) => ({ ...line, image: "/images/lego.png" })) },
    },
  });
  return id;
}

beforeAll(async () => {
  await resetDatabase();
  await testDb.category.create({ data: { id: "c", name: "C", description: "C", image: "/images/lego.png", position: 0 } });
  await testDb.theme.create({ data: { id: "t", slug: "t", name: "T", position: 0 } });
  for (const id of ["a", "b"]) {
    await testDb.product.create({
      data: { id, name: `Set ${id}`, price: 1000, categoryId: "c", themeId: "t", type: "x", age: "x", pieces: "x", highlight: "x", img: "/images/lego.png", shortDescription: "x", description: "x", searchText: id, searchName: id, interests: [], images: [] },
    });
  }
  const a = { productId: "a", name: "Set a", unitPrice: 1000 };
  const b = { productId: "b", name: "Set b", unitPrice: 2500 };
  // 02:30 UTC on the 18th is 23:30 on the 17th in Buenos Aires: a sale of the 17th.
  await order("PAID", at("2026-10-18T02:30:00Z"), [{ ...a, quantity: 2 }]);
  await order("DELIVERED", at("2026-10-18T13:00:00Z"), [{ ...b, quantity: 1 }], { paymentMethodType: "ticket" });
  await order("SHIPPED", at("2026-10-10T13:00:00Z"), [{ ...a, quantity: 1 }, { ...b, quantity: 2 }]);
  // Refunded (cancelled after paying): not revenue.
  await order("CANCELLED", at("2026-10-18T14:00:00Z"), [{ ...b, quantity: 4 }]);
  // A checkout nobody paid: counts as a checkout, not as a sale.
  await order("PENDING", null, [{ ...a, quantity: 1 }]);
  // Before the range.
  await order("PAID", at("2026-08-01T13:00:00Z"), [{ ...a, quantity: 9 }]);

  const coupon = await testDb.coupon.create({ data: { code: "PRUEBA", type: "FIXED", value: 100 } });
  const paidWithCoupon = await order("PAID", at("2026-10-12T13:00:00Z"), [{ ...a, quantity: 1 }], { discount: 100, total: 900, couponCode: "PRUEBA" });
  // The trigger moves the use to REDEEMED/RELEASED with the order's status; written here as the trigger would leave them.
  await testDb.couponRedemption.create({ data: { couponId: coupon.id, orderId: paidWithCoupon, email: "x@report.test", discount: 100, status: "REDEEMED", redeemedAt: at("2026-10-12T13:00:00Z") } });
});

describe("getDashboardReport", () => {
  it("sums what the store kept, by the store day it was paid", async () => {
    const report = await getDashboardReport(testDb, { from: "2026-10-01", to: "2026-10-18" }, NOW);
    expect(report.range).toEqual({ from: "2026-10-01", to: "2026-10-18", days: 18 });
    // 2000 (17th, Buenos Aires time) + 2500 (18th) + 6000 (10th) + 900 (12th, with the coupon); the last 7 days start on the 12th.
    expect(report).toMatchObject({ revenue: 11_400, paidOrders: 4, averageOrder: 2850, revenueToday: 2500, revenue7d: 5400, revenue30d: 11_400 });
    const day = (date: string) => report.sales.find((row) => row.day === date);
    expect(day("2026-10-17")).toEqual({ day: "2026-10-17", revenue: 2000, orders: 1 });
    expect(day("2026-10-18")).toEqual({ day: "2026-10-18", revenue: 2500, orders: 1 });
    expect(day("2026-10-11")).toEqual({ day: "2026-10-11", revenue: 0, orders: 0 });
    expect(report.sales).toHaveLength(18);
  });

  it("ranks products and payment methods, and counts coupon uses and the conversion proxy", async () => {
    const report = await getDashboardReport(testDb, { from: "2026-10-01", to: "2026-10-18" }, NOW);
    expect(report.topProducts).toEqual([
      { productId: "b", name: "Set b", units: 3, revenue: 7500 },
      { productId: "a", name: "Set a", units: 4, revenue: 4000 },
    ]);
    expect(report.byMethod).toEqual([
      { label: "Mercado Pago · Tarjeta de crédito", revenue: 8900, orders: 3 },
      { label: "Mercado Pago · Efectivo", revenue: 2500, orders: 1 },
    ]);
    expect(report.coupons).toEqual([{ code: "PRUEBA", uses: 1, discount: 100, reserved: 0 }]);
    // Orders created in the range: the 5 dated in October plus the unpaid checkout; 4 of them collected.
    expect(report).toMatchObject({ checkouts: 6, checkoutsPaid: 4 });
    expect(report.placedByStatus).toMatchObject({ PAID: 2, SHIPPED: 1, DELIVERED: 1, CANCELLED: 1, PENDING: 0 });
  });

  it("is empty for a range without sales", async () => {
    const report = await getDashboardReport(testDb, { from: "2026-09-01", to: "2026-09-07" }, NOW);
    expect(report).toMatchObject({ revenue: 0, paidOrders: 0, averageOrder: 0, topProducts: [], byMethod: [], coupons: [] });
    expect(report.sales.every((row) => row.revenue === 0)).toBe(true);
  });
});
