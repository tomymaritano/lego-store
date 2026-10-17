import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialsSignin } from "next-auth";
import { rateLimits } from "@/lib/rate-limit";
import { resetDatabase, testDb } from "./setup/db";

/*
 * The login and registration Server Actions against the test database.
 * Auth.js's signIn() is stubbed at the boundary (it would set cookies and
 * redirect inside a real request); everything else is real: validation,
 * rate limits, the user rows.
 */

const signIn = vi.hoisted(() => vi.fn());
const requestHeaders = vi.hoisted(() => ({ current: new Headers({ "x-forwarded-for": "203.0.113.50" }) }));

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

vi.mock("@/lib/auth", () => ({ signIn, signOut: vi.fn(), isGoogleEnabled: () => false }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { url });
  },
}));

const { loginAction, registerAction } = await import("@/app/(auth)/actions");

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const signUp = (overrides: Record<string, string> = {}) =>
  form({
    name: "Ana Pérez",
    email: "Ana@Tienda.test",
    password: "bloques-42",
    confirmPassword: "bloques-42",
    callbackUrl: "/item/1",
    ...overrides,
  });

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  signIn.mockReset();
  // One trusted proxy in front: the right-most X-Forwarded-For entry is the client.
  vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
  await testDb.rateLimit.deleteMany();
  requestHeaders.current = new Headers({ "x-forwarded-for": "203.0.113.50" });
});

describe("registerAction", () => {
  it("creates the account (email lowercased) and signs in, returning to a same-site callback", async () => {
    await registerAction({}, signUp());
    const user = await testDb.user.findUniqueOrThrow({ where: { email: "ana@tienda.test" } });
    expect(user).toMatchObject({ name: "Ana Pérez", role: "USER" });
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "ana@tienda.test", password: "bloques-42", redirectTo: "/item/1" });
  });

  it("never redirects off-site after signing up", async () => {
    await registerAction({}, signUp({ email: "bruno@tienda.test", callbackUrl: "https://evil.example.com" }));
    expect(signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ redirectTo: "/" }));
  });

  it("returns Spanish field errors and the typed values (never passwords) for invalid input", async () => {
    const state = await registerAction({}, signUp({ name: "A", email: "nope", password: "corta", confirmPassword: "otra" }));
    expect(state).toEqual({
      status: "error",
      fieldErrors: {
        name: "Ingresa tu nombre (al menos 2 caracteres)",
        email: "Ingresa un email válido",
        password: "La contraseña tiene que tener al menos 8 caracteres",
        confirmPassword: "Las contraseñas no coinciden",
      },
      values: { name: "A", email: "nope" },
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("says when the email already has an account", async () => {
    const state = await registerAction({}, signUp({ email: "ANA@tienda.test" }));
    expect(state.fieldErrors?.email).toMatch(/^Ya existe una cuenta con ese email/);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("does not let anyone register ADMIN_EMAIL (it would be an unverified admin)", async () => {
    vi.stubEnv("ADMIN_EMAIL", "duena@tienda.test");
    const state = await registerAction({}, signUp({ email: "DUENA@tienda.test" }));
    expect(state.fieldErrors?.email).toMatch(/^Ya existe una cuenta con ese email/);
    expect(await testDb.user.count({ where: { email: "duena@tienda.test" } })).toBe(0);
    expect(signIn).not.toHaveBeenCalled();
  });

  it(`limits new accounts per IP (${rateLimits.registerIp.limit} per hour)`, async () => {
    await testDb.rateLimit.create({
      data: { key: "register-ip:203.0.113.50", count: rateLimits.registerIp.limit, resetAt: new Date(Date.now() + 30 * 60_000) },
    });
    const state = await registerAction({}, signUp({ email: "carla@tienda.test" }));
    expect(state.message).toBe("Se crearon demasiadas cuentas desde tu conexión. Vuelve a intentarlo en 30 minutos.");
    expect(await testDb.user.count({ where: { email: "carla@tienda.test" } })).toBe(0);

    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.7" });
    await registerAction({}, signUp({ email: "carla@tienda.test" }));
    expect(await testDb.user.count({ where: { email: "carla@tienda.test" } })).toBe(1);
  });
});

describe("loginAction", () => {
  it("validates before calling Auth.js", async () => {
    const state = await loginAction({}, form({ email: "", password: "" }));
    expect(state.fieldErrors).toEqual({ email: "Ingresa tu email", password: "Ingresa tu contraseña" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with the normalised email and a sanitised callback", async () => {
    await loginAction({}, form({ email: " ANA@tienda.test ", password: "bloques-42", callbackUrl: "//evil.example.com" }));
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "ana@tienda.test", password: "bloques-42", redirectTo: "/" });
  });

  it("turns wrong credentials and rate limiting into messages, keeping the email", async () => {
    signIn.mockRejectedValueOnce(new CredentialsSignin());
    expect(await loginAction({}, form({ email: "ana@tienda.test", password: "mala" }))).toEqual({
      status: "error",
      message: "El email o la contraseña no son correctos.",
      values: { email: "ana@tienda.test" },
    });

    signIn.mockRejectedValueOnce(new RateLimitedSignin());
    expect((await loginAction({}, form({ email: "ana@tienda.test", password: "mala" }))).message).toMatch(/^Demasiados intentos/);
  });

  it("lets the success redirect through", async () => {
    signIn.mockRejectedValueOnce(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" }));
    await expect(loginAction({}, form({ email: "ana@tienda.test", password: "bloques-42" }))).rejects.toThrow("NEXT_REDIRECT");
  });
});
