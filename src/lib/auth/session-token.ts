import "server-only";

import type { JWT } from "next-auth/jwt";
import { getAccountUser } from "./accounts";
import { signPayload, verifyPayload } from "./signing";

/*
 * Refreshing a session token (Auth.js's jwt callback with trigger "update").
 *
 * Auth.js runs that callback for the app's own unstable_update() calls AND
 * for any client that POSTs /api/auth/session with a CSRF token, with
 * whatever `data` the client sends. So a refresh may only repeat what the
 * database says (name, email, role); it must never move a token to a newer
 * sessionVersion on its own, or a token revoked by a password change could
 * revive itself.
 *
 * The one legitimate move to a newer version is the password-change action
 * renewing its own session. It hands the update a renewal made on the server
 * (sessionRenewal()): signed with AUTH_SECRET, naming the user and the exact
 * old and new versions, and valid for a minute. It never leaves the server
 * (unstable_update() calls Auth.js in process), and a client cannot forge one.
 */

const PURPOSE = "session-renewal";
const RENEWAL_TTL_MS = 60_000;

export interface SessionRenewal {
  userId: string;
  /** The version the token carries now (before the change). */
  from: number;
  /** The account's version after the change. */
  to: number;
  expiresAt: number;
  signature: string;
}

const payload = ({ userId, from, to, expiresAt }: Omit<SessionRenewal, "signature">) => `${userId}|${from}|${to}|${expiresAt}`;

/** A renewal for the password-change action; null without AUTH_SECRET (no session could exist then). */
export function sessionRenewal(userId: string, from: number, to: number, now = Date.now()): SessionRenewal | null {
  const fields = { userId, from, to, expiresAt: now + RENEWAL_TTL_MS };
  const signature = signPayload(PURPOSE, payload(fields));
  return signature ? { ...fields, signature } : null;
}

function isValidRenewal(value: unknown, userId: string, from: number, to: number, now: number): boolean {
  if (typeof value !== "object" || value === null) return false;
  const renewal = value as Partial<SessionRenewal>;
  if (renewal.userId !== userId || renewal.from !== from || renewal.to !== to) return false;
  if (typeof renewal.expiresAt !== "number" || renewal.expiresAt < now) return false;
  return verifyPayload(PURPOSE, payload({ userId, from, to, expiresAt: renewal.expiresAt }), renewal.signature);
}

/**
 * The refreshed token, or null to end the session (Auth.js then clears the
 * cookie): the user is gone, or the token's version is stale and `data` holds
 * no valid renewal for exactly this move.
 */
export async function refreshSessionToken(token: JWT, data: unknown, now = Date.now()): Promise<JWT | null> {
  if (!token.sub) return null;
  const fresh = await getAccountUser(token.sub);
  if (!fresh) return null;
  const current = token.sv ?? 0;
  if (fresh.sessionVersion !== current) {
    const renewal = typeof data === "object" && data !== null ? (data as { renewal?: unknown }).renewal : undefined;
    if (!isValidRenewal(renewal, token.sub, current, fresh.sessionVersion, now)) return null;
  }
  return { ...token, name: fresh.name, email: fresh.email, role: fresh.role, sv: fresh.sessionVersion };
}
