import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";
import type { CancelReason, OrderStatus, OrderView } from "./types";

/*
 * Reading orders. Every function takes the client first (the app's, a test's
 * or a transaction's), like the rest of the server code. The account pages
 * only ever ask for the signed-in user's own orders (userId in the query);
 * the checkout checks access with ./access.ts.
 */

export const orderViewSelect = {
  id: true,
  number: true,
  userId: true,
  status: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  subtotal: true,
  shipping: true,
  total: true,
  paymentBrand: true,
  paymentLast4: true,
  paymentProvider: true,
  paymentMethodType: true,
  installments: true,
  ticketUrl: true,
  ticketExpiresAt: true,
  createdAt: true,
  submittedAt: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  cancelReason: true,
  items: {
    select: { productId: true, name: true, unitPrice: true, image: true, quantity: true },
    orderBy: { id: "asc" },
  },
} as const satisfies Prisma.OrderSelect;

export type OrderViewRow = Prisma.OrderGetPayload<{ select: typeof orderViewSelect }>;

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toOrderView(row: OrderViewRow): OrderView {
  return {
    id: row.id,
    number: row.number,
    status: row.status as OrderStatus,
    email: row.email,
    shippingAddress: {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zipCode,
      country: row.country,
    },
    items: row.items,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    paymentBrand: row.paymentBrand,
    paymentLast4: row.paymentLast4,
    payment: {
      provider: row.paymentProvider,
      methodType: row.paymentMethodType,
      installments: row.installments,
      ticketUrl: row.ticketUrl,
      ticketExpiresAt: iso(row.ticketExpiresAt),
    },
    createdAt: row.createdAt.toISOString(),
    submittedAt: iso(row.submittedAt),
    paidAt: iso(row.paidAt),
    shippedAt: iso(row.shippedAt),
    deliveredAt: iso(row.deliveredAt),
    cancelledAt: iso(row.cancelledAt),
    cancelReason: row.cancelReason as CancelReason | null,
    hasAccount: row.userId !== null,
  };
}

/** One order by id, any owner (callers check access). */
export async function getOrderView(db: Db, orderId: string): Promise<OrderView | null> {
  const row = await db.order.findUnique({ where: { id: orderId }, select: orderViewSelect });
  return row ? toOrderView(row) : null;
}

/** One summary row of "Mis pedidos". */
export interface OrderSummary {
  id: string;
  number: number;
  status: OrderStatus;
  total: number;
  /** When it was placed ("Realizar pedido"). */
  placedAt: string;
  /** Products (lines) in the order. */
  lineCount: number;
  /** Units across its lines. */
  itemCount: number;
  /** Up to three line pictures, for the row's thumbnails. */
  images: string[];
  firstItemName: string | null;
  /** A Mercado Pago payment still pending: a cash ticket (with until when it can be paid) or a card under review. */
  pendingPayment: { ticket: boolean; expiresAt: string | null } | null;
}

/**
 * The user's orders, newest first: the ones whose payment was submitted
 * ("Realizar pedido"). A checkout that never got that far is not a purchase,
 * so it is not listed even after the cleanup cancels it.
 */
export async function listUserOrders(db: Db, userId: string, { take = 50 }: { take?: number } = {}): Promise<OrderSummary[]> {
  const rows = await db.order.findMany({
    where: { userId, submittedAt: { not: null } },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      submittedAt: true,
      paymentMethodType: true,
      ticketExpiresAt: true,
      items: { select: { name: true, image: true, quantity: true }, orderBy: { id: "asc" } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status as OrderStatus,
    total: row.total,
    // Listed orders are submitted (the where above).
    placedAt: row.submittedAt!.toISOString(),
    lineCount: row.items.length,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    images: row.items.slice(0, 3).map((item) => item.image),
    firstItemName: row.items[0]?.name ?? null,
    pendingPayment:
      row.status === "PAYMENT_PENDING" ? { ticket: row.paymentMethodType === "ticket", expiresAt: iso(row.ticketExpiresAt) } : null,
  }));
}

/** One of the user's orders; null when it does not exist or belongs to someone else. */
export async function getUserOrder(db: Db, userId: string, orderId: string): Promise<OrderView | null> {
  const row = await db.order.findFirst({ where: { id: orderId, userId }, select: orderViewSelect });
  return row ? toOrderView(row) : null;
}
