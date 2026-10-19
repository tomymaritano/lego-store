import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Who may read and pay an order from the checkout.
 *
 * Creating an order hands the browser a random access token in an HttpOnly
 * cookie (the database keeps only its sha256). A guest's browser proves with
 * it that the order is its own, so the confirmation can poll the order's
 * status and a retried payment reaches the same order. A signed-in owner
 * qualifies by their account. The order's id alone grants nothing.
 *
 * The token is a guest's key and only for the checkout: an order on an
 * account is reached with that account's session alone (signing out locks
 * it, whatever cookie the browser still holds), and once a guest's order
 * is settled (paid or cancelled) the token keeps working only long enough
 * for the confirmation to show it. Signing out also deletes the cookie
 * (src/lib/auth/actions.ts).
 */

export const CHECKOUT_COOKIE = "lego-checkout";
/** A checkout is short; the cookie only has to outlive one. */
export const CHECKOUT_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

export interface CheckoutAccess {
  orderId: string;
  token: string;
}

export const newAccessToken = () => randomBytes(32).toString("base64url");

export const hashAccessToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function serializeCheckoutCookie({ orderId, token }: CheckoutAccess): string {
  return `${orderId}.${token}`;
}

export function parseCheckoutCookie(value: string | undefined | null): CheckoutAccess | null {
  if (!value) return null;
  const match = /^([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{43})$/.exec(value);
  return match ? { orderId: match[1]!, token: match[2]! } : null;
}

export function checkoutCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHECKOUT_COOKIE_MAX_AGE_SECONDS,
  };
}

/** Whether `token` is the one the order was created with. */
export function tokenMatches(token: string | null | undefined, hash: string | null | undefined): boolean {
  if (!token || !hash) return false;
  const given = Buffer.from(hashAccessToken(token), "hex");
  const stored = Buffer.from(hash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

export interface Requester {
  /** The signed-in user, if any. */
  userId: string | null;
  /** The checkout cookie this browser sent, if any. */
  access: CheckoutAccess | null;
}

/** How long a guest's token still opens its order after it was paid or cancelled (the confirmation's polling and a reload). */
export const SETTLED_TOKEN_ACCESS_MS = 60 * 60 * 1000;

export interface AccessCheckedOrder {
  id: string;
  userId: string | null;
  checkoutTokenHash: string | null;
  status: string;
  paidAt: Date | null;
  cancelledAt: Date | null;
}

/** What canAccessOrder needs of an Order row (a Prisma select). */
export const accessSelect = {
  id: true,
  userId: true,
  checkoutTokenHash: true,
  status: true,
  paidAt: true,
  cancelledAt: true,
} as const;

/**
 * May this requester see and pay the order? An account's order: only that
 * account's session. A guest's order: the browser holding its token, while
 * it is pending (or its payment is) and for a short while after it settled.
 */
export function canAccessOrder(order: AccessCheckedOrder, requester: Requester, now: Date = new Date()): boolean {
  if (order.userId) return order.userId === requester.userId;
  if (requester.access?.orderId !== order.id || !tokenMatches(requester.access.token, order.checkoutTokenHash)) return false;
  // Still waiting for its payment (PAYMENT_PENDING: a cash ticket, a card under review) counts as pending.
  if (order.status === "PENDING" || order.status === "PAYMENT_PENDING") return true;
  const settledAt = order.cancelledAt ?? order.paidAt;
  return settledAt !== null && now.getTime() - settledAt.getTime() < SETTLED_TOKEN_ACCESS_MS;
}
