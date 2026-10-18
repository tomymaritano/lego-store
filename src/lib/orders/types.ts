import type { ShippingInfo } from "@/types";

/*
 * Orders as the browser and the emails see them (client-safe: plain data,
 * dates as ISO strings). Built on the server from the Order row by
 * toOrderView (./queries.ts); amounts are integer pesos.
 */

export type OrderStatus = "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";

/** Why an order was cancelled (Order.cancelReason). */
export type CancelReason =
  | "out_of_stock"
  | "amount_mismatch"
  | "payment_canceled"
  | "expired"
  | "superseded"
  | "payment_setup_failed"
  | "admin";

export interface OrderLineView {
  /** Null once the product was deleted (the snapshot below still describes it). */
  productId: string | null;
  name: string;
  unitPrice: number;
  image: string;
  quantity: number;
}

export interface OrderView {
  id: string;
  number: number;
  status: OrderStatus;
  email: string;
  shippingAddress: ShippingInfo;
  items: OrderLineView[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentBrand: string | null;
  paymentLast4: string | null;
  createdAt: string;
  /** First payment attempt; null for a checkout that never got to "Realizar pedido". */
  submittedAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: CancelReason | null;
  /** Whether the order belongs to an account (guest orders have no "Mis pedidos" page). */
  hasAccount: boolean;
}

/** The checkout's view of its order: the order plus what the browser needs next. */
export interface CheckoutOrderResponse {
  order: OrderView;
}

/** A line the server could not sell as asked (sold out, fewer units left, or gone). */
export interface UnavailableLine {
  productId: string;
  name: string | null;
  /** Units left (0 when sold out or deleted). */
  available: number;
}

export type CheckoutErrorCode =
  | "invalid"
  | "empty"
  | "unavailable"
  | "payment_method"
  | "payments_unconfigured"
  | "rate_limited"
  | "not_found"
  | "not_pending"
  | "declined"
  | "server";

export interface CheckoutError {
  error: string;
  code: CheckoutErrorCode;
  unavailable?: UnavailableLine[];
}

/** POST /api/checkout/orders/<id>/pay */
export type PayResponse =
  | { next: "done"; order: OrderView }
  | { next: "action"; clientSecret: string; order: OrderView };
