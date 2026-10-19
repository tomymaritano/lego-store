import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/rate-limit";
import type { RateLimiter } from "@/lib/rate-limit/limiter";
import { normalizeEmail, roleForEmail } from "./email";
import { hashPassword, verifyPassword } from "./password";

/*
 * Account writes and credential checks, on the server only. Inputs arrive
 * already validated (src/lib/validations/auth.ts) except where noted; emails
 * are normalised again here anyway, because the database CHECK rejects
 * anything else.
 */

/** What a signed-in session needs to know about a user. */
export interface AccountUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  sessionVersion: number;
}

const accountSelect = { id: true, name: true, email: true, role: true, sessionVersion: true } as const;

/** Whether an admin blocked the account (src/lib/admin/users.ts): it cannot sign in, its sessions do not count. */
export type AccountStatus = { blocked: boolean };

export type RegisterResult = { ok: true; user: AccountUser } | { ok: false; reason: "email_taken" };

/**
 * Creates a password account, always as USER.
 *
 * ADMIN_EMAIL cannot be registered here at all (answered like a taken email):
 * nobody verifies the address, so whoever registered it first, say on a fresh
 * database, would become admin. That account comes only from the seed
 * (`npm run db:seed` with ADMIN_EMAIL / ADMIN_PASSWORD) or from a Google
 * sign-in with an address Google has verified (adapter.ts).
 */
export async function registerUser(input: { name: string; email: string; password: string }): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  // Hashed first either way, so refusing the admin address takes as long as a registration.
  const passwordHash = await hashPassword(input.password);
  if (roleForEmail(email) === "ADMIN") {
    // The visitor only sees "email taken"; the operator who forgot to seed sees why here.
    console.warn("[auth] Registration refused for ADMIN_EMAIL: create the admin with `npm run db:seed` (ADMIN_PASSWORD).");
    return { ok: false, reason: "email_taken" };
  }
  try {
    const user = await getDb().user.create({
      data: { name: input.name.trim(), email, passwordHash, role: "USER" },
      select: accountSelect,
    });
    return { ok: true, user };
  } catch (error) {
    // The unique index decides, so two registrations racing for one email cannot both win.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "email_taken" };
    }
    throw error;
  }
}

export type CredentialsResult =
  | { ok: true; user: AccountUser }
  | { ok: false; reason: "invalid" }
  /** The right password for an account an admin blocked: only said to whoever knows the password. */
  | { ok: false; reason: "blocked" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

/**
 * Checks an email and password (raw input: this is what the Credentials
 * provider's authorize() calls). Unknown emails, accounts without a password
 * (Google only) and wrong passwords are all just "invalid", and take about as
 * long as a real check, so the answer does not reveal which accounts exist.
 *
 * Rate limits, checked in this order and stopping at the first refusal (so
 * a refused attempt does not also eat into the wider limits):
 * 1. per account and source (tight). The source is the IP, or the device id
 *    when the browser proves an earlier login to this account (known-device.ts);
 * 2. per IP, any account (against guessing across accounts);
 * 3. per account from anywhere (against guessing spread over many IPs).
 * Known devices only go through the first: they are not guessing (they
 * logged in to this account before), and whoever fills the shared counters
 * cannot lock the owner out of the browsers they already use.
 * A successful login clears its account-and-source counter. A blocked
 * account (src/lib/admin/users.ts) is refused after the password check, so
 * only its owner learns why.
 */
export async function verifyCredentials(
  rawEmail: string,
  password: string,
  ip: string,
  { knownDevice = null }: { knownDevice?: string | null } = {}
): Promise<CredentialsResult> {
  const email = normalizeEmail(rawEmail);
  const source = knownDevice ? `${email}|device:${knownDevice}` : `${email}|${ip}`;
  const limits: [RateLimiter, string][] = knownDevice
    ? [[rateLimits.loginAccountIp, source]]
    : [
        [rateLimits.loginAccountIp, source],
        [rateLimits.loginIp, ip],
        [rateLimits.loginAccount, email],
      ];
  for (const [limiter, subject] of limits) {
    const limit = await limiter.consume(subject);
    if (!limit.ok) return { ok: false, reason: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const user = await getDb().user.findUnique({ where: { email }, select: { ...accountSelect, passwordHash: true, blockedAt: true } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user?.passwordHash || !valid) return { ok: false, reason: "invalid" };
  if (user.blockedAt) return { ok: false, reason: "blocked" };

  await rateLimits.loginAccountIp.reset(source);
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, sessionVersion: user.sessionVersion } };
}

export async function getAccountUser(id: string): Promise<(AccountUser & AccountStatus & { hasPassword: boolean }) | null> {
  const user = await getDb().user.findUnique({ where: { id }, select: { ...accountSelect, passwordHash: true, blockedAt: true } });
  if (!user) return null;
  const { passwordHash, blockedAt, ...account } = user;
  return { ...account, hasPassword: passwordHash !== null, blocked: blockedAt !== null };
}

/** True when the account with this email exists and an admin blocked it (Google sign-in checks it). */
export async function isBlockedEmail(email: string): Promise<boolean> {
  const user = await getDb().user.findUnique({ where: { email: normalizeEmail(email) }, select: { blockedAt: true } });
  return Boolean(user?.blockedAt);
}

/**
 * Renames the account. Returns the products the user has reviewed when the
 * name actually changed: their cached review lists show the author's name
 * and must be refreshed (empty otherwise).
 */
export async function updateUserName(id: string, name: string): Promise<{ reviewedProductIds: string[] }> {
  const next = name.trim();
  const db = getDb();
  const before = await db.user.findUnique({ where: { id }, select: { name: true } });
  await db.user.update({ where: { id }, data: { name: next } });
  if (before?.name === next) return { reviewedProductIds: [] };
  const reviews = await db.review.findMany({ where: { userId: id }, select: { productId: true } });
  return { reviewedProductIds: reviews.map((review) => review.productId) };
}

export type ChangePasswordResult =
  /** The account's session version before and after the change (to renew the caller's own session). */
  | { ok: true; sessionVersion: { from: number; to: number } }
  | { ok: false; reason: "wrong_password" | "no_password" | "conflict" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

/**
 * Replaces the password after checking the current one, and bumps the
 * session version: every other session of this account stops working (the
 * caller renews its own token with sessionRenewal(), see session-token.ts).
 */
export async function changeUserPassword(id: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const limit = await rateLimits.passwordChange.consume(id);
  if (!limit.ok) return { ok: false, reason: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  const user = await getDb().user.findUnique({ where: { id }, select: { passwordHash: true, sessionVersion: true } });
  if (!user?.passwordHash) return { ok: false, reason: "no_password" };
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return { ok: false, reason: "wrong_password" };

  const passwordHash = await hashPassword(newPassword);
  // Only from the version just read: if another change landed in between, this one loses
  // (and must not hand out a renewal that skips the other change's revocation).
  const { count } = await getDb().user.updateMany({
    where: { id, sessionVersion: user.sessionVersion },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
  if (count === 0) return { ok: false, reason: "conflict" };
  await rateLimits.passwordChange.reset(id);
  return { ok: true, sessionVersion: { from: user.sessionVersion, to: user.sessionVersion + 1 } };
}

/**
 * Ends every session of the account, on every device (bumps the session
 * version: tokens issued before stop working on their next request).
 */
export async function revokeAllSessions(id: string): Promise<void> {
  await getDb().user.updateMany({ where: { id }, data: { sessionVersion: { increment: 1 } } });
}

/*
 * A hash of a random throwaway password, compared against when there is no
 * real hash, so a login for an unknown email costs one bcrypt comparison like
 * any other. Computed once per process.
 */
let dummy: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  dummy ??= hashPassword(crypto.randomUUID());
  return dummy;
}
