import { STORE_TIME_ZONE } from "@/lib/argentina";
import type { OrderStatus } from "@/lib/orders/types";
import { ADMIN_PAGE_SIZE } from "@/lib/validations/admin";

/*
 * What the admin panel's server code and its pages share. Client-safe.
 */

/** Stock at or under this counts as low (the dashboard lists them, sold out first). */
export const LOW_STOCK = 5;

/** One page of a paginated admin list. `page` is clamped to the pages that exist. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export const pageCount = (total: number, size = ADMIN_PAGE_SIZE) => Math.max(1, Math.ceil(total / size));

/**
 * The status changes an admin can make, from each status (design doc,
 * "Cambios de estado del admin"). Shipped and delivered orders cannot be
 * cancelled; PENDING -> PAID is only ever the webhook's (a real payment).
 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, readonly ("SHIPPED" | "DELIVERED" | "CANCELLED")[]> = {
  PENDING: ["CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) =>
  (ADMIN_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The store's calendar date of an instant, "2026-10-18". */
export const storeDate = (at: Date) => dayFormat.format(at);

/**
 * When a store calendar date ("2026-10-18") starts, as an instant. Argentina
 * keeps UTC-3 all year (no daylight saving since 2009), so the offset is fixed.
 */
export const storeDayStart = (date: string) => new Date(`${date}T00:00:00-03:00`);

/** The instant the next store day starts (an exclusive upper bound for `date`). */
export function storeDayEnd(date: string): Date {
  const start = storeDayStart(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

const adminDateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: STORE_TIME_ZONE,
});

/**
 * "18/01/2024, 14:05" (store time zone): the admin's tables and order pages
 * span years of orders, so the year is always there (the customer's
 * formatOrderDateTime leaves it out).
 */
export const formatAdminDateTime = (iso: string) => adminDateTimeFormat.format(new Date(iso));
