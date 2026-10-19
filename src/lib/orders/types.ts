import type { ShippingInfo } from "@/types";

/*
 * Orders as the browser and the emails see them (client-safe: plain data,
 * dates as ISO strings). Built on the server from the Order row by
 * toOrderView (./queries.ts); amounts are integer pesos.
 */

/**
 * PENDING: prepared on "Revisar", not paid. PAYMENT_PENDING: the provider took
 * the payment but has not settled it (a Mercado Pago cash ticket waiting to be
 * paid, a card under review). PAID onwards: the money is in.
 */
export type OrderStatus = "PENDING" | "PAYMENT_PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";

/** Who takes the order's payment (Order.paymentProvider). */
export type PaymentProviderId = "STRIPE" | "MERCADOPAGO";

/** Why an order was cancelled (Order.cancelReason). */
export type CancelReason =
  | "out_of_stock"
  | "amount_mismatch"
  | "payment_canceled"
  | "expired"
  | "superseded"
  | "payment_setup_failed"
  | "refunded"
  /** A payment that arrived after the order was cancelled (a ticket paid after it expired): the store refunded it. */
  | "late_payment_refunded"
  /** Mercado Pago rejected a payment that was under review (or a ticket's payment). */
  | "payment_rejected"
  /** The customer disputed the charge with their bank (Mercado Pago charged_back). */
  | "chargeback"
  /**
   * Paid on Mercado Pago's site (Checkout Pro) with a coupon that no longer
   * fit by then (its hold lapsed and the use was taken, the email had used
   * it up, it expired): refunded, or the pending payment cancelled.
   */
  | "coupon_unavailable"
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
  /** Taken off the products by the coupon (0 without one). total = subtotal - discount + shipping. */
  discount: number;
  /** The coupon's code, as applied (null without one). */
  couponCode: string | null;
  shipping: number;
  total: number;
  paymentBrand: string | null;
  paymentLast4: string | null;
  /** How it is paid (Mercado Pago orders tell more than the card). */
  payment: OrderPaymentView;
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

export interface OrderPaymentView {
  provider: PaymentProviderId;
  /** credit_card, debit_card, prepaid_card, ticket, account_money...; null for Stripe (always a card) or before paying. */
  methodType: string | null;
  installments: number | null;
  /** Cash payments: the ticket to pay with, and until when (ISO). */
  ticketUrl: string | null;
  ticketExpiresAt: string | null;
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
  /** The coupon cannot be used: `error` says why (expired, used up, under its minimum...). */
  | "coupon"
  | "payments_unconfigured"
  | "rate_limited"
  | "not_found"
  | "not_pending"
  | "declined"
  | "server";

/** What "Realizar pedido" answers for a Mercado Pago order. */
export type MercadoPagoPayResponse =
  /** Approved, or taken and waiting (a cash ticket, a card under review): the order shows where it stands. */
  | { next: "done"; order: OrderView }
  /** "Cuenta de Mercado Pago": the customer pays on Mercado Pago's site and comes back. */
  | { next: "redirect"; url: string; order: OrderView };

export interface CheckoutError {
  error: string;
  code: CheckoutErrorCode;
  unavailable?: UnavailableLine[];
  /** With code "coupon": why (src/lib/coupons/rules.ts CouponRejection). */
  rejection?: string;
}

/** POST /api/checkout/orders/<id>/pay */
export type PayResponse =
  | { next: "done"; order: OrderView }
  | { next: "action"; clientSecret: string; order: OrderView };
