import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { findByUnsubscribeToken, hashUnsubscribeToken, listSubscribers, subscribe } from "@/lib/newsletter";
import { listAdminMessages } from "@/lib/contact/messages";
import { parseMessageFilters } from "@/lib/validations/inbox";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * The contact form and the newsletter against the test database: messages
 * stored for the inbox (with the store's email notice), the honeypot and
 * the rate limits, the admin's status changes (audited, admins only), and
 * subscriptions with their unsubscribe token (hashed at rest, single
 * address, a GET-free unsubscribe through the action).
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
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

const publicActions = await import("@/lib/contact/actions");
const adminActions = await import("@/lib/admin/actions");

let admin: { id: string; email: string };
const emails = vi.spyOn(console, "info").mockImplementation(() => {});

const message = (overrides: Record<string, unknown> = {}) => ({
  name: "Ana Pérez",
  email: "Ana@Example.com",
  topic: "pedido",
  orderNumber: "lego-001001",
  message: "Hola, quería saber cuándo llega mi pedido. ¡Gracias!",
  ...overrides,
});

const sentEmails = () => emails.mock.calls.map(([text]) => String(text)).filter((text) => text.includes("[email]"));

beforeAll(async () => {
  await resetAndSeed();
  admin = await testDb.user.create({ data: { email: "bandeja@admin.test", role: "ADMIN" }, select: { id: true, email: true } });
  delete process.env.RESEND_API_KEY;
  delete process.env.STORE_NOTIFY_EMAIL;
});

beforeEach(async () => {
  session.current = null;
  emails.mockClear();
  await testDb.rateLimit.deleteMany({});
});

describe("the contact form", () => {
  it("stores the message for the inbox and tells the store", async () => {
    expect(await publicActions.sendContactMessageAction(message())).toEqual({ ok: true, email: "ana@example.com" });
    const row = await testDb.contactMessage.findFirstOrThrow({ where: { email: "ana@example.com" } });
    expect(row).toMatchObject({ topic: "pedido", name: "Ana Pérez", orderNumber: "LEGO-001001", status: "NEW", userId: null, ip: null });
    const [notice] = sentEmails();
    // Without STORE_NOTIFY_EMAIL: the settings' contact email, by console (no Resend).
    expect(notice).toContain("Para: hola@legostore.com");
    expect(notice).toContain("Nuevo mensaje de contacto: Estado de un pedido");
    expect(notice).toContain(`/admin/mensajes/${row.id}`);
  });

  it("validates on the server, and a filled honeypot stores nothing", async () => {
    expect(await publicActions.sendContactMessageAction(message({ email: "no", topic: "spam", message: "corto" }))).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(String), topic: expect.any(String), message: expect.any(String) },
    });
    const before = await testDb.contactMessage.count();
    expect(await publicActions.sendContactMessageAction({ ...message({ email: "bot@spam.test" }), website: "https://spam.test" })).toEqual({ ok: true, email: "bot@spam.test" });
    expect(await testDb.contactMessage.count()).toBe(before);
    expect(sentEmails()).toEqual([]);
  });

  it("is rate limited per sender email and per IP", async () => {
    for (let i = 0; i < 3; i++) expect(await publicActions.sendContactMessageAction(message({ email: "insiste@example.com" }))).toMatchObject({ ok: true });
    expect(await publicActions.sendContactMessageAction(message({ email: "insiste@example.com" }))).toMatchObject({ ok: false, error: expect.stringContaining("demasiados") });
    // The 3 above and this one share the "unknown" IP (no proxy trusted): 5 per hour.
    expect(await publicActions.sendContactMessageAction(message({ email: "otra@example.com" }))).toMatchObject({ ok: true });
    expect(await publicActions.sendContactMessageAction(message({ email: "tercera@example.com" }))).toMatchObject({ ok: false });
  });

  it("links a signed-in sender's account", async () => {
    const customer = await testDb.user.create({ data: { email: "cliente@bandeja.test" } });
    session.current = { user: { id: customer.id, role: "USER" }, sessionVersion: 0 };
    await publicActions.sendContactMessageAction(message({ email: "cliente@bandeja.test" }));
    expect(await testDb.contactMessage.findFirstOrThrow({ where: { email: "cliente@bandeja.test" } })).toMatchObject({ userId: customer.id });
  });
});

describe("the inbox", () => {
  it("filters by view, topic and text", async () => {
    const db = getDb();
    const inbox = await listAdminMessages(db, parseMessageFilters({}));
    expect(inbox.items.length).toBeGreaterThan(0);
    expect(inbox.unread).toBe(inbox.items.filter((row) => row.status === "NEW").length);
    expect((await listAdminMessages(db, parseMessageFilters({ q: "LEGO-001001" }))).items.every((row) => row.orderNumber === "LEGO-001001")).toBe(true);
    expect((await listAdminMessages(db, parseMessageFilters({ topic: "devolucion" }))).total).toBe(0);
    expect(parseMessageFilters({ view: "drop table", topic: "x" })).toMatchObject({ view: "inbox", topic: "" });
  });

  it("marks read and archives, audited and for admins only", async () => {
    const row = await testDb.contactMessage.findFirstOrThrow({ where: { email: "ana@example.com" } });
    await expect(adminActions.setMessageStatusAction(row.id, "READ")).rejects.toThrow(/NEXT_REDIRECT \/login/);

    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    expect(await adminActions.setMessageStatusAction(row.id, "READ")).toEqual({ ok: true, message: "Lo marcamos como leído." });
    const read = await testDb.contactMessage.findUniqueOrThrow({ where: { id: row.id } });
    expect(read).toMatchObject({ status: "READ", readAt: expect.any(Date) });
    expect(await adminActions.setMessageStatusAction(row.id, "ARCHIVED")).toMatchObject({ ok: true });
    expect(await testDb.contactMessage.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "ARCHIVED", readAt: read.readAt, archivedAt: expect.any(Date) });
    expect((await listAdminMessages(getDb(), parseMessageFilters({}))).items.some((item) => item.id === row.id)).toBe(false);
    expect((await listAdminMessages(getDb(), parseMessageFilters({ view: "ARCHIVED" }))).items.map((item) => item.id)).toContain(row.id);
    expect(await adminActions.setMessageStatusAction(row.id, "DELETED")).toMatchObject({ ok: false });

    const entries = await testDb.auditLog.findMany({ where: { entityType: "message", entityId: row.id }, orderBy: { createdAt: "asc" }, select: { action: true, changes: true, actorEmail: true } });
    expect(entries).toEqual([
      { action: "message.read", changes: { status: ["NEW", "READ"] }, actorEmail: admin.email },
      { action: "message.archive", changes: { status: ["READ", "ARCHIVED"] }, actorEmail: admin.email },
    ]);
  });
});

describe("the newsletter", () => {
  const tokenIn = (text: string) => /token=([A-Za-z0-9_-]{43})/.exec(text)?.[1] ?? null;

  it("subscribes once, stores only the token's hash and sends the welcome with the unsubscribe link", async () => {
    expect(await publicActions.subscribeNewsletterAction("  Fan@Lego.com ", "footer")).toEqual({ ok: true, email: "fan@lego.com", message: "¡Listo! Te sumamos al newsletter." });
    const [welcome] = sentEmails();
    expect(welcome).toContain("Para: fan@lego.com");
    const token = tokenIn(welcome!)!;
    expect(token).not.toBeNull();
    const row = await testDb.newsletterSubscriber.findUniqueOrThrow({ where: { email: "fan@lego.com" } });
    expect(row).toMatchObject({ source: "footer", unsubscribedAt: null, unsubscribeTokenHash: hashUnsubscribeToken(token) });
    expect(JSON.stringify(row)).not.toContain(token);

    // Again: same answer, no second row, no second email (nobody learns who is subscribed).
    emails.mockClear();
    expect(await publicActions.subscribeNewsletterAction("fan@lego.com")).toMatchObject({ ok: true });
    expect(await testDb.newsletterSubscriber.count({ where: { email: "fan@lego.com" } })).toBe(1);
    expect(sentEmails()).toEqual([]);
    expect(await publicActions.subscribeNewsletterAction("no-es-email")).toEqual({ ok: false, error: "Ingresa un email válido" });
  });

  it("unsubscribes with the link's token only, once, and a re-subscription issues a new token", async () => {
    const { token } = (await subscribe(testDb, { email: "baja@lego.com", source: "footer" })) as { token: string };
    expect(await findByUnsubscribeToken(testDb, token)).toEqual({ found: true, email: "ba**@lego.com", active: true });
    expect(await publicActions.unsubscribeNewsletterAction("x".repeat(43))).toBe("invalid");
    expect(await publicActions.unsubscribeNewsletterAction("<script>")).toBe("invalid");
    expect(await publicActions.unsubscribeNewsletterAction(token)).toBe("unsubscribed");
    expect(await testDb.newsletterSubscriber.findUniqueOrThrow({ where: { email: "baja@lego.com" } })).toMatchObject({ unsubscribedAt: expect.any(Date) });
    expect(await publicActions.unsubscribeNewsletterAction(token)).toBe("already");

    const again = await subscribe(testDb, { email: "baja@lego.com", source: "footer" });
    expect(again.status).toBe("resubscribed");
    expect(await publicActions.unsubscribeNewsletterAction(token)).toBe("invalid");
    expect(await publicActions.unsubscribeNewsletterAction((again as { token: string }).token)).toBe("unsubscribed");
  });

  it("lists and searches subscribers for the admin", async () => {
    const page = await listSubscribers(testDb, { q: "lego.com", status: "", page: 1 });
    expect(page.items.map((row) => row.email).sort()).toEqual(["baja@lego.com", "fan@lego.com"]);
    expect((await listSubscribers(testDb, { q: "", status: "unsubscribed", page: 1 })).items.map((row) => row.email)).toEqual(["baja@lego.com"]);
    expect(page.active).toBe(1);
  });
});
