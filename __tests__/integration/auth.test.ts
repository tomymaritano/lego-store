import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeUserPassword,
  getAccountUser,
  registerUser,
  updateUserName,
  verifyCredentials,
} from "@/lib/auth/accounts";
import { prismaAuthAdapter } from "@/lib/auth/adapter";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimits } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";
import { resetDatabase, testDb } from "./setup/db";

/*
 * Accounts against the test database: registration (normalised emails,
 * ADMIN_EMAIL role, duplicates), credential checks with their rate limits,
 * profile and password changes, and the OAuth adapter.
 */

const PASSWORD = "bloques-de-prueba-42";
const IP = "203.0.113.10";

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  await testDb.rateLimit.deleteMany();
  vi.stubEnv("ADMIN_EMAIL", "jefa@tienda.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

let counter = 0;
const email = (label = "user") => `${label}-${++counter}@tienda.test`;

describe("registerUser", () => {
  it("creates a USER with a bcrypt hash and the email lowercased", async () => {
    const address = email();
    const result = await registerUser({ name: " Ana Pérez ", email: `  ${address.toUpperCase()} `, password: PASSWORD });
    expect(result).toMatchObject({ ok: true, user: { email: address, name: "Ana Pérez", role: "USER", sessionVersion: 0 } });

    const row = await testDb.user.findUniqueOrThrow({ where: { email: address } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword(PASSWORD, row.passwordHash!)).toBe(true);
  });

  it("gives ADMIN_EMAIL the ADMIN role, whatever the casing", async () => {
    const result = await registerUser({ name: "Jefa", email: "JEFA@Tienda.test", password: PASSWORD });
    expect(result).toMatchObject({ ok: true, user: { email: "jefa@tienda.test", role: "ADMIN" } });
  });

  it("refuses a second account for the same email, even with other casing", async () => {
    const address = email();
    await registerUser({ name: "Uno", email: address, password: PASSWORD });
    expect(await registerUser({ name: "Dos", email: address.toUpperCase(), password: PASSWORD })).toEqual({
      ok: false,
      reason: "email_taken",
    });
  });

  it("lets only one of two simultaneous registrations for an email win", async () => {
    const address = email("race");
    const results = await Promise.all([
      registerUser({ name: "A", email: address, password: PASSWORD }),
      registerUser({ name: "B", email: address, password: PASSWORD }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await testDb.user.count({ where: { email: address } })).toBe(1);
  });
});

describe("verifyCredentials", () => {
  it("accepts the right password with any email casing", async () => {
    const address = email();
    await registerUser({ name: "Ana", email: address, password: PASSWORD });
    const result = await verifyCredentials(` ${address.toUpperCase()}`, PASSWORD, IP);
    expect(result).toMatchObject({ ok: true, user: { email: address, role: "USER" } });
  });

  it("says only 'invalid' for a wrong password, an unknown email or a Google-only account", async () => {
    const address = email();
    await registerUser({ name: "Ana", email: address, password: PASSWORD });
    const google = email("google");
    await testDb.user.create({ data: { email: google, name: "G" } });

    expect(await verifyCredentials(address, "otra-clave", IP)).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyCredentials(email("nadie"), PASSWORD, IP)).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyCredentials(google, PASSWORD, IP)).toEqual({ ok: false, reason: "invalid" });
  });

  it(`locks an account on one IP after ${rateLimits.loginAccountIp.limit} attempts, even for the right password`, async () => {
    const address = email();
    await registerUser({ name: "Ana", email: address, password: PASSWORD });
    for (let i = 0; i < rateLimits.loginAccountIp.limit; i++) {
      expect((await verifyCredentials(address, `mala-${i}`, IP)).ok).toBe(false);
    }
    const locked = await verifyCredentials(address, PASSWORD, IP);
    expect(locked).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(locked.ok === false && locked.reason === "rate_limited" && locked.retryAfterSeconds).toBeGreaterThan(800);

    // A stranger guessing from their IP does not lock the owner out on theirs.
    expect((await verifyCredentials(address, PASSWORD, "198.51.100.1")).ok).toBe(true);
    // Other accounts on the same IP are unaffected.
    const other = email();
    await registerUser({ name: "Bruno", email: other, password: PASSWORD });
    expect((await verifyCredentials(other, PASSWORD, IP)).ok).toBe(true);
  });

  it(`limits one account to ${rateLimits.loginAccount.limit} attempts an hour from all IPs together`, async () => {
    const address = email();
    await registerUser({ name: "Ana", email: address, password: PASSWORD });
    await testDb.rateLimit.create({
      data: { key: `login-account:${address}`, count: rateLimits.loginAccount.limit, resetAt: new Date(Date.now() + 60_000) },
    });
    expect(await verifyCredentials(address, PASSWORD, "198.51.100.2")).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  it("a successful login clears the account's failed attempts on that IP", async () => {
    const address = email();
    await registerUser({ name: "Ana", email: address, password: PASSWORD });
    for (let i = 0; i < rateLimits.loginAccountIp.limit - 1; i++) await verifyCredentials(address, "mala", IP);
    expect((await verifyCredentials(address, PASSWORD, IP)).ok).toBe(true);
    expect(await testDb.rateLimit.findUnique({ where: { key: `login-account-ip:${address}|${IP}` } })).toBeNull();
    expect((await verifyCredentials(address, "mala", IP)).ok).toBe(false);
    expect((await verifyCredentials(address, PASSWORD, IP)).ok).toBe(true);
  });

  it("limits attempts per IP across accounts", async () => {
    await testDb.rateLimit.create({
      data: { key: `login-ip:${IP}`, count: rateLimits.loginIp.limit, resetAt: new Date(Date.now() + 60_000) },
    });
    const address = email();
    await registerUser({ name: "Ana", email: address, password: PASSWORD });
    expect(await verifyCredentials(address, PASSWORD, IP)).toMatchObject({ ok: false, reason: "rate_limited" });
    expect((await verifyCredentials(address, PASSWORD, "198.51.100.99")).ok).toBe(true);
  });
});

describe("profile and password", () => {
  it("updates the name (trimmed)", async () => {
    const { user } = (await registerUser({ name: "Ana", email: email(), password: PASSWORD })) as { user: { id: string } };
    await updateUserName(user.id, "  Ana María ");
    expect(await getAccountUser(user.id)).toMatchObject({ name: "Ana María", hasPassword: true });
  });

  it("changes the password after checking the current one, and bumps the session version", async () => {
    const address = email();
    const { user } = (await registerUser({ name: "Ana", email: address, password: PASSWORD })) as { user: { id: string } };

    expect(await changeUserPassword(user.id, "no-es", "nueva-clave-99")).toEqual({ ok: false, reason: "wrong_password" });
    expect((await getAccountUser(user.id))!.sessionVersion).toBe(0);

    expect(await changeUserPassword(user.id, PASSWORD, "nueva-clave-99")).toEqual({ ok: true });
    expect((await getAccountUser(user.id))!.sessionVersion).toBe(1);
    expect((await verifyCredentials(address, PASSWORD, IP)).ok).toBe(false);
    expect((await verifyCredentials(address, "nueva-clave-99", IP)).ok).toBe(true);
  });

  it("refuses accounts without a password and rate-limits wrong guesses", async () => {
    const google = await testDb.user.create({ data: { email: email("google"), name: "G" } });
    expect(await changeUserPassword(google.id, "x", "nueva-clave-99")).toEqual({ ok: false, reason: "no_password" });

    const { user } = (await registerUser({ name: "Ana", email: email(), password: PASSWORD })) as { user: { id: string } };
    for (let i = 0; i < rateLimits.passwordChange.limit; i++) await changeUserPassword(user.id, "mala", "nueva-clave-99");
    expect(await changeUserPassword(user.id, PASSWORD, "nueva-clave-99")).toMatchObject({ ok: false, reason: "rate_limited" });
  });
});

describe("prismaAuthAdapter (Google sign-in)", () => {
  const adapter = prismaAuthAdapter(getDb);

  it("creates OAuth users with the email lowercased and the role by ADMIN_EMAIL", async () => {
    const created = await adapter.createUser!({ id: "ignored", name: "Gabi", email: "Gabi@Gmail.COM", emailVerified: new Date(), image: null });
    expect(created).toMatchObject({ email: "gabi@gmail.com", role: "USER", sessionVersion: 0 });
    expect(created).not.toHaveProperty("passwordHash");

    vi.stubEnv("ADMIN_EMAIL", "oauth-jefa@tienda.test");
    const admin = await adapter.createUser!({ id: "x", name: "Jefa", email: "OAuth-Jefa@Tienda.TEST", emailVerified: new Date() });
    expect(admin).toMatchObject({ email: "oauth-jefa@tienda.test", role: "ADMIN" });
  });

  it("finds users by email case-insensitively and by linked account", async () => {
    const user = await adapter.createUser!({ id: "x", name: "Lu", email: "lu@gmail.com", emailVerified: null });
    expect(await adapter.getUserByEmail!("LU@GMAIL.COM")).toMatchObject({ id: user.id });

    await adapter.linkAccount!({ userId: user.id, type: "oidc", provider: "google", providerAccountId: "g-123", access_token: "t" });
    expect(await adapter.getUserByAccount!({ provider: "google", providerAccountId: "g-123" })).toMatchObject({ id: user.id });
    expect(await adapter.getUserByAccount!({ provider: "google", providerAccountId: "nope" })).toBeNull();

    await adapter.unlinkAccount!({ provider: "google", providerAccountId: "g-123" });
    expect(await adapter.getUserByAccount!({ provider: "google", providerAccountId: "g-123" })).toBeNull();
  });

  it("updateUser only touches profile fields and keeps emails lowercase", async () => {
    const user = await adapter.createUser!({ id: "x", name: "Mia", email: "mia@gmail.com", emailVerified: null });
    const updated = await adapter.updateUser!({ id: user.id, email: "MIA2@Gmail.com", image: "https://example.com/a.png" });
    expect(updated).toMatchObject({ email: "mia2@gmail.com", image: "https://example.com/a.png", name: "Mia", role: "USER" });
  });
});
