import "server-only";

import { getDb } from "@/lib/db";
import { createRateLimiter, type RateLimiter } from "./limiter";
import { postgresStore } from "./postgres";

/*
 * The app's rate limiters, all backed by Postgres (shared by every server
 * instance; see ./limiter.ts for the model and ./postgres.ts for the store).
 *
 * To limit something new (contact form, newsletter), add an entry
 * here and call `consume(subject)` before doing the work, with the user id
 * when there is one and the client IP otherwise.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const store = postgresStore(getDb);
const limiter = (name: string, limit: number, windowMs: number): RateLimiter =>
  createRateLimiter({ name, limit, windowMs, store });

export const rateLimits = {
  /**
   * Login attempts per account from one source: the tight limit. The source
   * is the IP, or the device for a browser that logged in to this account
   * before (lib/auth/known-device.ts), so a stranger guessing wrong does not
   * lock the owner out. Cleared by a successful login.
   */
  loginAccountIp: limiter("login-account-ip", 5, 15 * MINUTE),
  /**
   * Login attempts per account from anywhere, unknown devices only: slows
   * down guessing spread over many IPs (see verifyCredentials).
   */
  loginAccount: limiter("login-account", 30, HOUR),
  /**
   * Login attempts per client IP, any account: slows down guessing across
   * accounts. Roomier than per account: many people can share one IP (offices,
   * campuses, mobile carriers).
   */
  loginIp: limiter("login-ip", 50, 15 * MINUTE),
  /** New accounts per client IP (same caveat about shared IPs). */
  registerIp: limiter("register-ip", 20, HOUR),
  /** Current-password checks on /account (per user). Cleared by a correct one. */
  passwordChange: limiter("password-change", 5, 15 * MINUTE),
  /** New reviews per user (one per product anyway; this slows down a spree across products). */
  reviewCreate: limiter("review-create", 10, HOUR),
  /**
   * Edits and deletions of one's own reviews, per user: each one expires the
   * product's cache (and, when the rating moves, the shared listings).
   */
  reviewEdit: limiter("review-edit", 20, HOUR),
  /** "Útil" votes per user: each one refreshes the product page's cache. */
  reviewHelpful: limiter("review-helpful", 60, 15 * MINUTE),
  /**
   * Reaching "Revisar" in checkout, per user or IP: each one writes an order
   * and calls Stripe (PaymentIntent, ConfirmationToken).
   */
  checkoutPrepare: limiter("checkout-prepare", 30, 15 * MINUTE),
  /** "Realizar pedido" (payment confirmations), per user or IP: slows down card testing. */
  checkoutPay: limiter("checkout-pay", 15, 15 * MINUTE),
} as const;

export { clientIp } from "./client-ip";
export { waitMessage, type RateLimitResult, type RateLimiter } from "./limiter";
