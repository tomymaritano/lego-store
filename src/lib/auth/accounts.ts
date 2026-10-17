import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/rate-limit";
import type { RateLimitResult } from "@/lib/rate-limit/limiter";
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

export type RegisterResult = { ok: true; user: AccountUser } | { ok: false; reason: "email_taken" };

/** Creates a password account. ADMIN_EMAIL gets the ADMIN role, like in the seed. */
export async function registerUser(input: { name: string; email: string; password: string }): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await getDb().user.create({
      data: { name: input.name.trim(), email, passwordHash, role: roleForEmail(email) },
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
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

/**
 * Checks an email and password (raw input: this is what the Credentials
 * provider's authorize() calls). Unknown emails, accounts without a password
 * (Google only) and wrong passwords are all just "invalid", and take about as
 * long as a real check, so the answer does not reveal which accounts exist.
 *
 * Rate limited per account and IP (tight), per account (roomier, against
 * guessing from many IPs) and per IP (against guessing across accounts).
 * Every attempt counts; a successful login clears the account-and-IP counter.
 */
export async function verifyCredentials(rawEmail: string, password: string, ip: string): Promise<CredentialsResult> {
  const email = normalizeEmail(rawEmail);
  const accountIp = `${email}|${ip}`;
  const limited = firstRefusal(
    await Promise.all([
      rateLimits.loginAccountIp.consume(accountIp),
      rateLimits.loginAccount.consume(email),
      rateLimits.loginIp.consume(ip),
    ])
  );
  if (limited) return { ok: false, reason: "rate_limited", retryAfterSeconds: limited.retryAfterSeconds };

  const user = await getDb().user.findUnique({ where: { email }, select: { ...accountSelect, passwordHash: true } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user?.passwordHash || !valid) return { ok: false, reason: "invalid" };

  await rateLimits.loginAccountIp.reset(accountIp);
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, sessionVersion: user.sessionVersion } };
}

export async function getAccountUser(id: string): Promise<(AccountUser & { hasPassword: boolean }) | null> {
  const user = await getDb().user.findUnique({ where: { id }, select: { ...accountSelect, passwordHash: true } });
  if (!user) return null;
  const { passwordHash, ...account } = user;
  return { ...account, hasPassword: passwordHash !== null };
}

export async function updateUserName(id: string, name: string): Promise<void> {
  await getDb().user.update({ where: { id }, data: { name: name.trim() } });
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "wrong_password" | "no_password" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

/**
 * Replaces the password after checking the current one, and bumps the
 * session version: every other session of this account stops working (the
 * caller refreshes its own token, see session.ts).
 */
export async function changeUserPassword(id: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const limit = await rateLimits.passwordChange.consume(id);
  if (!limit.ok) return { ok: false, reason: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  const user = await getDb().user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!user?.passwordHash) return { ok: false, reason: "no_password" };
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return { ok: false, reason: "wrong_password" };

  const passwordHash = await hashPassword(newPassword);
  await getDb().user.update({ where: { id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
  await rateLimits.passwordChange.reset(id);
  return { ok: true };
}

function firstRefusal(results: RateLimitResult[]): RateLimitResult | undefined {
  const refused = results.filter((result) => !result.ok);
  return refused.sort((a, b) => b.retryAfterSeconds - a.retryAfterSeconds)[0];
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
