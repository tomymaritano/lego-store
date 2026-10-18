import { describe, expect, it } from "vitest";
import { ADMIN_TRANSITIONS, canTransition, formatAdminDateTime, pageCount, storeDate, storeDayEnd, storeDayStart } from "@/lib/admin/format";
import { pageHref } from "@/components/admin/Pagination";
import { orderTransitionSchema, parseOrderFilters, parseProductFilters, parseReviewFilters, stockUpdateSchema } from "@/lib/validations/admin";

describe("admin status transitions (design doc)", () => {
  it("allows exactly PENDING→CANCELLED, PAID→SHIPPED|CANCELLED, SHIPPED→DELIVERED", () => {
    expect(ADMIN_TRANSITIONS).toEqual({
      PENDING: ["CANCELLED"],
      PAID: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    });
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("PENDING", "PAID")).toBe(false);
  });

  it("the action schema only takes the admin's targets", () => {
    expect(orderTransitionSchema.safeParse({ orderId: "a", to: "PAID", expected: "PENDING" }).success).toBe(false);
    expect(orderTransitionSchema.safeParse({ orderId: "a", to: "SHIPPED", expected: "PAID" }).success).toBe(true);
    expect(orderTransitionSchema.safeParse({ orderId: "", to: "SHIPPED", expected: "PAID" }).success).toBe(false);
  });
});

describe("store calendar days (Argentina, UTC-3)", () => {
  it("maps instants to the store's date and back", () => {
    expect(storeDate(new Date("2026-10-18T02:59:00Z"))).toBe("2026-10-17");
    expect(storeDate(new Date("2026-10-18T03:00:00Z"))).toBe("2026-10-18");
    expect(storeDayStart("2026-10-18").toISOString()).toBe("2026-10-18T03:00:00.000Z");
    expect(storeDayEnd("2026-10-18").toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });
});

describe("admin list filters from the URL", () => {
  it("products: defaults, valid values, junk ignored", () => {
    expect(parseProductFilters({})).toEqual({ q: "", category: "", status: "active", stock: "", page: 1 });
    expect(parseProductFilters({ q: "  star ", category: "cars", status: "archived", stock: "low", page: "3" })).toEqual({
      q: "star",
      category: "cars",
      status: "archived",
      stock: "low",
      page: 3,
    });
    expect(parseProductFilters({ status: "deleted", stock: "lots", page: "-2", q: ["a", "b"] })).toMatchObject({
      status: "active",
      stock: "",
      page: 1,
      q: "a",
    });
  });

  it("orders: statuses, amount_mismatch, dates", () => {
    expect(parseOrderFilters({ status: "amount_mismatch", from: "2026-10-01", to: "2026-13-45", q: "ana@x.com", page: "x" })).toEqual({
      status: "amount_mismatch",
      from: "2026-10-01",
      to: "",
      q: "ana@x.com",
      page: 1,
    });
    expect(parseOrderFilters({ status: "LOST" }).status).toBe("");
    // Checkouts that never reached "Realizar pedido" have their own filter.
    expect(parseOrderFilters({ status: "draft" }).status).toBe("draft");
  });

  it("reviews: rating 1 to 5 only", () => {
    expect(parseReviewFilters({ rating: "5", product: "7" })).toMatchObject({ rating: 5, product: "7" });
    expect(parseReviewFilters({ rating: "6" }).rating).toBeNull();
  });

  it("stock edits are whole, non-negative numbers", () => {
    expect(stockUpdateSchema.safeParse({ productId: "1", stock: "12", seen: "3" })).toMatchObject({ success: true, data: { stock: 12, seen: 3 } });
    for (const stock of ["-1", "1.5", "", "1e3", "abc", "2000000"]) {
      expect(stockUpdateSchema.safeParse({ productId: "1", stock, seen: "3" }).success, stock).toBe(false);
    }
    // The stock the admin saw is required: without it the write could undo a sale.
    for (const seen of [undefined, "", "-1", "x"]) {
      expect(stockUpdateSchema.safeParse({ productId: "1", stock: "12", seen }).success, String(seen)).toBe(false);
    }
  });

  it("admin dates always carry the year (store time)", () => {
    expect(formatAdminDateTime("2024-01-18T17:05:00Z")).toBe("18/01/2024, 14:05");
    expect(formatAdminDateTime("2026-01-01T02:30:00Z")).toBe("31/12/2025, 23:30");
  });
});

describe("pagination", () => {
  it("counts pages and keeps the filters in the links", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(41)).toBe(3);
    expect(pageHref("/admin/orders", { q: "ana", status: "", page: 4 }, 2)).toBe("/admin/orders?q=ana&page=2");
    expect(pageHref("/admin/orders", { q: "", status: "PAID" }, 1)).toBe("/admin/orders?status=PAID");
  });
});
