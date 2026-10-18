import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth/password";
import { setUserBlocked, setUserRole, listAdminUsers, getAdminUser } from "@/lib/admin/users";
import { parseUserFilters } from "@/lib/validations/users";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * The admin's users section against the test database, with Auth.js's
 * auth() stubbed: who may call it, the role rules (never your own account,
 * never the last active admin, even when two admins demote each other at
 * once), blocking (logins refused, every session ended, the account's
 * Google sign-in refused too), the list's numbers, and the audit entries
 * each change writes, with the admin's IP.
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
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

const actions = await import("@/lib/admin/actions");
const data = await import("@/lib/admin/data");
const { verifyCredentials, isBlockedEmail } = await import("@/lib/auth/accounts");
const { getCurrentUser } = await import("@/lib/auth/session");

const PASSWORD = "bloques-de-prueba-42";

type Account = { id: string; email: string };
let jefa: Account;
let segunda: Account;
let cliente: Account;

const signInAs = async (user: Account | null) => {
  if (!user) {
    session.current = null;
    return;
  }
  const row = await testDb.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true, sessionVersion: true } });
  session.current = { user: { id: user.id, role: row.role }, sessionVersion: row.sessionVersion };
};

const entriesFor = (entityId: string) => testDb.auditLog.findMany({ where: { entityType: "user", entityId }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  await resetAndSeed();
  const passwordHash = await hashPassword(PASSWORD);
  const select = { id: true, email: true } as const;
  jefa = await testDb.user.create({ data: { email: "jefa@usuarios.test", name: "Jefa", role: "ADMIN", passwordHash }, select });
  segunda = await testDb.user.create({ data: { email: "segunda@usuarios.test", name: "Segunda", role: "ADMIN", passwordHash }, select });
  cliente = await testDb.user.create({ data: { email: "cliente@usuarios.test", name: "Cliente", passwordHash }, select });
});

beforeEach(async () => {
  await signInAs(null);
  requestHeaders.current = new Headers();
  vi.unstubAllEnvs();
});

describe("who can manage users", () => {
  const calls = {
    setUserRoleAction: () => actions.setUserRoleAction("x", "ADMIN"),
    setUserBlockedAction: () => actions.setUserBlockedAction("x", true),
    getAdminUsers: () => data.getAdminUsers(parseUserFilters({})),
    getAdminUserDetail: () => data.getAdminUserDetail("x"),
    getAdminAuditLog: () => data.getAdminAuditLog({ actor: "", entity: "", entityId: "", action: "", from: "", to: "", page: 1 }),
  };

  it.each(Object.entries(calls))("%s: a visitor is sent to log in, a customer gets the 403", async (_name, call) => {
    await expect(call()).rejects.toThrow(/NEXT_REDIRECT \/login\?callbackUrl=%2Fadmin/);
    await signInAs(cliente);
    await expect(call()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    // A token that claims ADMIN does not make a customer one.
    session.current = { user: { id: cliente.id, role: "ADMIN" }, sessionVersion: 0 };
    await expect(call()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
  });
});

describe("roles", () => {
  it("an admin promotes and demotes a customer; each change is audited with the IP", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    requestHeaders.current = new Headers({ "x-forwarded-for": "203.0.113.9" });
    await signInAs(jefa);
    expect(await actions.setUserRoleAction(cliente.id, "ADMIN")).toMatchObject({ ok: true });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: cliente.id } })).role).toBe("ADMIN");
    expect(await actions.setUserRoleAction(cliente.id, "ADMIN")).toEqual({ ok: true, message: "Ya era admin." });
    expect(await actions.setUserRoleAction(cliente.id, "USER")).toMatchObject({ ok: true });
    expect(vi.mocked(revalidatePath).mock.calls.flat()).toEqual(expect.arrayContaining(["/admin/users", `/admin/users/${cliente.id}`]));

    const entries = await entriesFor(cliente.id);
    expect(entries.map((entry) => [entry.action, entry.changes, entry.actorEmail, entry.ip])).toEqual([
      ["user.role", { role: ["USER", "ADMIN"] }, jefa.email, "203.0.113.9"],
      ["user.role", { role: ["ADMIN", "USER"] }, jefa.email, "203.0.113.9"],
    ]);
  });

  it("no one changes their own role, and invalid input is refused", async () => {
    await signInAs(jefa);
    expect(await actions.setUserRoleAction(jefa.id, "USER")).toEqual({ ok: false, error: "No puedes cambiar tu propio rol." });
    expect(await actions.setUserRoleAction(cliente.id, "SUPERADMIN")).toMatchObject({ ok: false });
    expect(await actions.setUserRoleAction("no-such-user", "ADMIN")).toMatchObject({ ok: false, error: expect.stringContaining("ya no existe") });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: jefa.id } })).role).toBe("ADMIN");
  });

  it("the last active admin cannot be demoted or blocked", async () => {
    // Someone acting without being an admin themselves (a script, a race): Jefa and Segunda are the admins.
    const outsider = { id: cliente.id, email: cliente.email };
    await testDb.user.update({ where: { id: segunda.id }, data: { blockedAt: new Date() } });
    try {
      expect(await setUserRole(testDb, outsider, jefa.id, "USER")).toEqual({ ok: false, reason: "last_admin" });
      expect(await setUserBlocked(testDb, outsider, jefa.id, true)).toEqual({ ok: false, reason: "last_admin" });
      // A blocked admin is not the last active one: it can be demoted.
      expect(await setUserRole(testDb, outsider, segunda.id, "USER")).toEqual({ ok: true, changed: true });
      expect((await getAdminUser(testDb, jefa.id))!.lastActiveAdmin).toBe(true);
    } finally {
      await testDb.user.update({ where: { id: segunda.id }, data: { blockedAt: null, role: "ADMIN" } });
    }
  });

  it("two admins demoting each other at once leave one admin", async () => {
    const results = await Promise.all([
      setUserRole(testDb, jefa, segunda.id, "USER"),
      setUserRole(testDb, segunda, jefa.id, "USER"),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "last_admin" }]);
    expect(await testDb.user.count({ where: { role: "ADMIN", blockedAt: null } })).toBe(1);
    await testDb.user.updateMany({ where: { id: { in: [jefa.id, segunda.id] } }, data: { role: "ADMIN" } });
  });
});

describe("blocking", () => {
  it("a blocked account cannot log in, its sessions end, and unblocking lets it back", async () => {
    await signInAs(cliente);
    expect((await getCurrentUser())?.id).toBe(cliente.id);
    const customerSession = session.current;
    const before = await testDb.user.findUniqueOrThrow({ where: { id: cliente.id } });

    await signInAs(jefa);
    const blocked = await actions.setUserBlockedAction(cliente.id, true, "  Fraude con tarjetas  ");
    expect(blocked).toMatchObject({ ok: true, message: expect.stringContaining("Bloqueamos la cuenta") });
    const after = await testDb.user.findUniqueOrThrow({ where: { id: cliente.id } });
    expect(after).toMatchObject({ blockedReason: "Fraude con tarjetas", sessionVersion: before.sessionVersion + 1 });
    expect(after.blockedAt).not.toBeNull();

    // The session the customer had no longer counts (stale version, and blocked anyway).
    session.current = customerSession;
    expect(await getCurrentUser()).toBeNull();
    session.current = { user: { id: cliente.id, role: "USER" }, sessionVersion: after.sessionVersion };
    expect(await getCurrentUser()).toBeNull();

    // The right password is refused with the reason; a wrong one stays "invalid".
    expect(await verifyCredentials(cliente.email, PASSWORD, "198.51.100.1")).toEqual({ ok: false, reason: "blocked" });
    expect(await verifyCredentials(cliente.email, "otra-contraseña-123", "198.51.100.1")).toEqual({ ok: false, reason: "invalid" });
    // Google sign-in checks the same flag.
    expect(await isBlockedEmail(" Cliente@Usuarios.test ")).toBe(true);

    await signInAs(jefa);
    expect(await actions.setUserBlockedAction(cliente.id, true)).toEqual({ ok: true, message: "La cuenta ya estaba bloqueada." });
    expect(await actions.setUserBlockedAction(cliente.id, false)).toMatchObject({ ok: true });
    expect(await testDb.user.findUniqueOrThrow({ where: { id: cliente.id } })).toMatchObject({ blockedAt: null, blockedReason: null });
    expect(await verifyCredentials(cliente.email, PASSWORD, "198.51.100.2")).toMatchObject({ ok: true });
    expect(await isBlockedEmail(cliente.email)).toBe(false);

    const actionsDone = (await entriesFor(cliente.id)).map((entry) => [entry.action, entry.changes]);
    expect(actionsDone.slice(-2)).toEqual([
      ["user.block", { blocked: [false, true], reason: "Fraude con tarjetas" }],
      ["user.unblock", { blocked: [true, false] }],
    ]);
  });

  it("no one blocks themselves; the reason has a limit", async () => {
    await signInAs(jefa);
    expect(await actions.setUserBlockedAction(jefa.id, true)).toEqual({ ok: false, error: "No puedes bloquear tu propia cuenta." });
    expect(await actions.setUserBlockedAction(cliente.id, true, "x".repeat(301))).toEqual({ ok: false, error: "Como máximo 300 caracteres" });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: cliente.id } })).blockedAt).toBeNull();
  });
});

describe("the list and the detail", () => {
  it("counts placed orders and what the store kept, and filters by role and status", async () => {
    const order = await testDb.order.findFirstOrThrow({ where: { status: "DELIVERED", userId: { not: null } } });
    const owner = order.userId!;
    const page = await listAdminUsers(testDb, parseUserFilters({ q: (await testDb.user.findUniqueOrThrow({ where: { id: owner } })).email }));
    const row = page.items.find((item) => item.id === owner)!;
    const placed = await testDb.order.count({ where: { userId: owner, submittedAt: { not: null } } });
    const kept = await testDb.order.aggregate({ where: { userId: owner, status: { in: ["PAID", "SHIPPED", "DELIVERED"] } }, _sum: { total: true } });
    expect(row).toMatchObject({ orders: placed, spent: kept._sum.total ?? 0, blocked: false });

    const admins = await listAdminUsers(testDb, parseUserFilters({ role: "ADMIN" }));
    expect(admins.items.map((item) => item.email).sort()).toEqual([jefa.email, segunda.email].sort());
    await testDb.user.update({ where: { id: cliente.id }, data: { blockedAt: new Date() } });
    expect((await listAdminUsers(testDb, parseUserFilters({ status: "blocked" }))).items.map((item) => item.id)).toEqual([cliente.id]);
    await testDb.user.update({ where: { id: cliente.id }, data: { blockedAt: null } });

    const detail = (await getAdminUser(testDb, owner))!;
    expect(detail.recentOrders.length).toBe(placed);
    expect(detail.addresses.length).toBeGreaterThan(0);
    expect(detail.addresses.reduce((sum, address) => sum + address.orders, 0)).toBe(placed);
  });

  it("counts every review the account wrote, apart from the list it shows", async () => {
    const products = await testDb.product.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 3 });
    await testDb.review.createMany({
      data: products.map((product, index) => ({ userId: segunda.id, productId: product.id, rating: 4, title: `Reseña ${index}`, comment: "Muy bueno para armar." })),
    });
    try {
      const detail = (await getAdminUser(testDb, segunda.id))!;
      expect(detail.reviewCount).toBe(await testDb.review.count({ where: { userId: segunda.id } }));
      expect(detail.reviewCount).toBe(3);
      expect(detail.reviews).toHaveLength(3);
    } finally {
      await testDb.review.deleteMany({ where: { userId: segunda.id } });
    }
  });
});
