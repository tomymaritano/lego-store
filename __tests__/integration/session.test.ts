import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerUser } from "@/lib/auth/accounts";
import { resetDatabase, testDb } from "./setup/db";

/*
 * The authorisation helpers (src/lib/auth/session.ts) against real users in
 * the test database. Auth.js's auth() is replaced by a stub returning the
 * session under test; redirect() and forbidden() throw like Next's do.
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  // React's cache() only memoises inside a server render; here, call straight through.
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { url });
  },
  forbidden: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;403");
  },
}));

const { authorizeRequest, getCurrentUser, requireAdmin, requireUser } = await import("@/lib/auth/session");

let customer: { id: string };
let admin: { id: string };

async function create(name: string, email: string) {
  const result = await registerUser({ name, email, password: "bloques-42" });
  if (!result.ok) throw new Error(`could not create ${email}`);
  return result.user;
}

beforeAll(async () => {
  await resetDatabase();
  customer = await create("Ana", "ana@tienda.test");
  // Admins never come from registration (the seed makes them): promote directly.
  admin = await create("Jefa", "jefa@tienda.test");
  await testDb.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
});

beforeEach(() => {
  session.current = null;
});

const signIn = (id: string, role = "USER", sessionVersion = 0) => {
  session.current = { user: { id, role }, sessionVersion };
};

describe("getCurrentUser", () => {
  it("is null without a session", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the user with the role from the database, never from the token", async () => {
    signIn(customer.id, "ADMIN");
    expect(await getCurrentUser()).toMatchObject({ id: customer.id, email: "ana@tienda.test", role: "USER", hasPassword: true });
  });

  it("is null once the session version is stale (password changed elsewhere) or the user is gone", async () => {
    await testDb.user.update({ where: { id: customer.id }, data: { sessionVersion: { increment: 1 } } });
    signIn(customer.id, "USER", 0);
    expect(await getCurrentUser()).toBeNull();
    signIn(customer.id, "USER", 1);
    expect(await getCurrentUser()).not.toBeNull();

    signIn("no-such-user");
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireUser / requireAdmin", () => {
  it("send visitors to login with a callback", async () => {
    await expect(requireUser({ callbackUrl: "/account" })).rejects.toMatchObject({ url: "/login?callbackUrl=%2Faccount" });
    await expect(requireAdmin()).rejects.toMatchObject({ url: "/login?callbackUrl=%2Fadmin" });
  });

  it("forbid customers from admin pages, even with a forged ADMIN token", async () => {
    signIn(customer.id, "ADMIN", 1);
    await expect(requireUser()).resolves.toMatchObject({ id: customer.id });
    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
  });

  it("let admins through", async () => {
    signIn(admin.id, "ADMIN");
    await expect(requireAdmin()).resolves.toMatchObject({ id: admin.id, role: "ADMIN" });
  });

  it("lose admin rights as soon as the database demotes the account", async () => {
    await testDb.user.update({ where: { id: admin.id }, data: { role: "USER" } });
    signIn(admin.id, "ADMIN");
    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    await testDb.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
  });
});

describe("authorizeRequest (Route Handlers)", () => {
  it("answers 401 without a session and 403 for a customer on admin routes", async () => {
    const anonymous = await authorizeRequest();
    expect("response" in anonymous && anonymous.response.status).toBe(401);

    signIn(customer.id, "USER", 1);
    expect(await authorizeRequest()).toMatchObject({ user: { id: customer.id } });
    const refused = await authorizeRequest({ admin: true });
    expect("response" in refused && refused.response.status).toBe(403);
    expect("response" in refused && (await refused.response.json())).toEqual({ error: "No tienes permiso para hacer esto." });

    signIn(admin.id, "ADMIN");
    expect(await authorizeRequest({ admin: true })).toMatchObject({ user: { id: admin.id } });
  });
});
