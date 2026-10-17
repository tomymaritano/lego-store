import "server-only";

import { getDb } from "@/lib/db";
import { createRateLimiter, type RateLimiter } from "./limiter";
import { postgresStore } from "./postgres";

/*
 * The app's rate limiters, all backed by Postgres (shared by every server
 * instance; see ./limiter.ts for the model and ./postgres.ts for the store).
 *
 * To limit something new (reviews, contact form, newsletter), add an entry
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
   * Login attempts per account from one IP: the tight limit. Keyed by both so
   * a stranger cannot lock someone out of their account by guessing wrong.
   * Cleared by a successful login.
   */
  loginAccountIp: limiter("login-account-ip", 5, 15 * MINUTE),
  /** Login attempts per account from anywhere: slows down guessing spread over many IPs. */
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
} as const;

export { clientIp } from "./client-ip";
export { waitMessage, type RateLimitResult, type RateLimiter } from "./limiter";
