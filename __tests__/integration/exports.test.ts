import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { exportCustomers, exportMessages, exportNewsletter, exportOrders, MESSAGE_EXPORT_HEADER, NEWSLETTER_EXPORT_HEADER, ORDER_EXPORT_HEADER, type CsvExport } from "@/lib/admin/exports";
import { formatOrderNumber } from "@/lib/orders/format";
import { unsubscribeUrl } from "@/lib/newsletter";
import { parseOrderFilters } from "@/lib/validations/admin";
import { parseMessageFilters, parseSubscriberFilters } from "@/lib/validations/inbox";
import { parseUserFilters } from "@/lib/validations/users";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * The admin's CSV exports through their Route Handler against the test
 * database: admins only, UTF-8 with BOM, ";" separated, one line per order
 * product, the list's filters, formulas neutralised, and every export in
 * the audit log with its filters and row count. The streams read the
 * database in batches; a tiny batch size checks that every row comes out
 * exactly once, in order, across batch boundaries.
 */

vi.stubEnv("AUTH_SECRET", "exports-integration-secret");

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});

const { GET } = await import("@/app/api/admin/export/[kind]/route");

let admin: { id: string; email: string };

const request = (kind: string, query = "", headers: Record<string, string> = {}) =>
  GET(new NextRequest(new URL(`/api/admin/export/${kind}${query}`, "http://localhost"), { headers }), { params: Promise.resolve({ kind }) });

async function csvOf(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  return { bom: [...bytes.slice(0, 3)], lines: text.replace(/^﻿/, "").split("\r\n").filter(Boolean) };
}

beforeAll(async () => {
  await resetAndSeed();
  admin = await testDb.user.create({ data: { email: "exporta@admin.test", role: "ADMIN" }, select: { id: true, email: true } });
  // A paid order whose customer typed a formula as their name, with two products.
  await testDb.order.create({
    data: {
      id: "export-order",
      email: "formula@export.test",
      status: "PAID",
      firstName: "=HYPERLINK(\"http://evil.test\")",
      lastName: "Pérez; Gómez",
      phone: "+54 11 5555-0000",
      address: "Av. Siempre Viva 742",
      city: "Rosario",
      state: "Santa Fe",
      zipCode: "2000",
      country: "Argentina",
      subtotal: 3289,
      discount: 0,
      shipping: 299,
      total: 3588,
      paymentProvider: "MERCADOPAGO",
      paymentMethodType: "credit_card",
      installments: 3,
      submittedAt: new Date(),
      paidAt: new Date(),
      items: {
        create: [
          { productId: "7", name: "Batmobile", unitPrice: 2490, image: "/images/lego.png", quantity: 1 },
          { productId: "20", name: "Groot Guardians", unitPrice: 799, image: "/images/lego.png", quantity: 1 },
        ],
      },
    },
  });
  await testDb.newsletterSubscriber.createMany({
    data: [
      { email: "activa@export.test", source: "footer" },
      { email: "-baja@export.test", source: "footer", unsubscribedAt: new Date() },
    ],
  });
});

beforeEach(() => {
  session.current = null;
});

describe("GET /api/admin/export/<kind>", () => {
  it("is for admins only, and only for the known exports", async () => {
    expect((await request("orders")).status).toBe(401);
    const customer = await testDb.user.create({ data: { email: "cliente@export.test" } });
    session.current = { user: { id: customer.id, role: "ADMIN" }, sessionVersion: 0 };
    expect((await request("orders")).status).toBe(403);
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    expect((await request("passwords")).status).toBe(404);
    expect(await testDb.auditLog.count({ where: { entityType: "export" } })).toBe(0);
  });

  it("refuses a link from another site before writing to the audit log, and serves the panel's own links", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    for (const site of ["cross-site", "same-site"]) {
      const response = await request("customers", "?q=csrf-probe", { "sec-fetch-site": site, "sec-fetch-mode": "navigate" });
      expect(response.status).toBe(403);
      expect(response.headers.get("content-disposition")).toBeNull();
    }
    expect(await testDb.auditLog.count({ where: { entityType: "export" } })).toBe(0);

    for (const site of ["same-origin", "none"]) {
      expect((await request("customers", "?q=csrf-probe", { "sec-fetch-site": site })).status).toBe(200);
    }
    expect(await testDb.auditLog.count({ where: { entityType: "export", entityId: "customers" } })).toBe(2);
    await testDb.auditLog.deleteMany({ where: { entityType: "export" } });
  });

  it("streams the orders as an Excel-friendly CSV, one line per product, with formulas neutralised", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    const response = await request("orders", "?q=formula@export.test");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="pedidos-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-export-rows")).toBe("1");

    const { bom, lines } = await csvOf(response);
    expect(bom).toEqual([0xef, 0xbb, 0xbf]);
    expect(lines[0]).toBe(ORDER_EXPORT_HEADER.join(";"));
    expect(lines).toHaveLength(3);
    const [batmobile, groot] = lines.slice(1);
    expect(batmobile).toContain(`"'=HYPERLINK(""http://evil.test"")"`);
    expect(batmobile).toContain('"Pérez; Gómez"');
    expect(batmobile).toContain("'+54 11 5555-0000");
    expect(batmobile).toMatch(/;Mercado Pago;Tarjeta de crédito;3;;3289;0;299;3588;Batmobile;7;1;2490;2490$/);
    expect(groot).toMatch(/;Groot Guardians;20;1;799;799$/);
    expect(batmobile!.startsWith("LEGO-")).toBe(true);

    const entry = await testDb.auditLog.findFirstOrThrow({ where: { entityType: "export", entityId: "orders" } });
    expect(entry).toMatchObject({ action: "export.orders", actorEmail: admin.email, changes: { filters: "q=formula@export.test", orders: 1, lines: 2 } });
  });

  it("exports every placed order without filters (the seed's delivered ones included)", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    const placed = await testDb.order.count({ where: { submittedAt: { not: null } } });
    const response = await request("orders");
    expect(response.headers.get("x-export-rows")).toBe(String(placed));
    const { lines } = await csvOf(response);
    const items = await testDb.orderItem.count({ where: { order: { submittedAt: { not: null } } } });
    expect(lines).toHaveLength(items + 1);
  });

  it("exports customers with their orders, spending and newsletter flag", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    await testDb.newsletterSubscriber.create({ data: { email: "exporta@admin.test", source: "footer" } });
    const { lines } = await csvOf(await request("customers", "?role=ADMIN"));
    expect(lines[0]).toBe("ID;Email;Nombre;Rol;Alta;Bloqueada;Pedidos;Gastado;Newsletter");
    expect(lines.find((line) => line.includes("exporta@admin.test"))).toMatch(/;Admin;\d{4}-\d{2}-\d{2} \d{2}:\d{2};no;0;0;sí$/);
    expect(lines.every((line, index) => index === 0 || line.includes(";Admin;"))).toBe(true);
  });

  it("exports the newsletter's subscribers with the list's filters, and each active one's unsubscribe link", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    const { lines } = await csvOf(await request("newsletter", "?q=export.test&status=unsubscribed"));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(NEWSLETTER_EXPORT_HEADER.join(";"));
    // No link for who already left.
    expect(lines[1]).toMatch(/^'-baja@export\.test;De baja;footer;[^;]+;[^;]+;$/);

    const active = await testDb.newsletterSubscriber.findUniqueOrThrow({ where: { email: "activa@export.test" } });
    const { lines: activeLines } = await csvOf(await request("newsletter", "?q=activa@export.test"));
    expect(activeLines[1]).toMatch(/^activa@export\.test;Activo;footer;/);
    expect(activeLines[1]!.endsWith(`;${unsubscribeUrl(active.id)}`)).toBe(true);
    expect(unsubscribeUrl(active.id)).toContain(`/newsletter/baja?token=${active.id}.`);
    const entry = await testDb.auditLog.findFirstOrThrow({ where: { entityType: "export", entityId: "newsletter" } });
    expect(entry.changes).toEqual({ filters: "q=export.test status=unsubscribed", rows: 1 });
  });
});

describe("GET /api/admin/export/messages", () => {
  it("exports the inbox's messages with its filters, formulas neutralised, and audits it", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    await testDb.contactMessage.createMany({
      data: [
        { topic: "pedido", name: "=SUM(A1:A9)", email: "msg1@export.test", orderNumber: "LS-000123", message: "Hola; ¿dónde está\nmi pedido?" },
        { topic: "otro", name: "Archivada", email: "msg2@export.test", message: "Vieja", status: "ARCHIVED", archivedAt: new Date() },
      ],
    });
    const { bom, lines } = await csvOf(await request("messages", "?q=export.test"));
    expect(bom).toEqual([0xef, 0xbb, 0xbf]);
    expect(lines[0]).toBe(MESSAGE_EXPORT_HEADER.join(";"));
    // The inbox (the default view) leaves the archived one out.
    expect(lines.filter((line) => line.includes("@export.test"))).toHaveLength(1);
    const row = lines.find((line) => line.includes("msg1@export.test"))!;
    expect(row).toContain(";Nuevo;");
    expect(row).toContain(";'=SUM(A1:A9);msg1@export.test;LS-000123;");
    expect(row).toContain('"Hola; ¿dónde está');

    const archived = await csvOf(await request("messages", "?q=export.test&view=ARCHIVED"));
    expect(archived.lines.slice(1)).toEqual([expect.stringContaining(";Archivado;")]);
    const entry = await testDb.auditLog.findFirstOrThrow({ where: { entityType: "export", entityId: "messages" }, orderBy: { createdAt: "desc" } });
    expect(entry).toMatchObject({ action: "export.messages", changes: { filters: "view=ARCHIVED q=export.test", rows: 1 } });
  });

  it("streams every message once, newest first, across batch boundaries", async () => {
    const all = await testDb.contactMessage.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
    const result = await exportMessages(testDb, { id: admin.id, email: admin.email }, parseMessageFilters({ view: "all" }), { batchSize: 1 });
    const { lines } = await csvOf(new Response(result.body));
    expect(lines.slice(1).map((line) => line.split(";")[0])).toEqual(all.map((row) => row.id));
  });
});

describe("batches", () => {
  const actor = () => ({ id: admin.id, email: admin.email });
  const rowsOf = async (result: CsvExport) => {
    const { lines } = await csvOf(new Response(result.body));
    return lines.slice(1);
  };

  it("streams every subscriber once, newest first, across batch boundaries (ties broken by id)", async () => {
    const at = new Date("2026-01-01T12:00:00Z");
    // Seven, three of them signed up at the very same moment.
    await testDb.newsletterSubscriber.createMany({
      data: Array.from({ length: 7 }, (_, index) => ({
        email: `lote-${index}@batch.test`,
        source: "footer",
        subscribedAt: new Date(at.getTime() + (index < 3 ? 0 : index) * 60_000),
      })),
    });
    const expected = await testDb.newsletterSubscriber.findMany({
      where: { email: { endsWith: "@batch.test" } },
      orderBy: [{ subscribedAt: "desc" }, { id: "desc" }],
      select: { email: true },
    });
    for (const batchSize of [3, 7, 1]) {
      const result = await exportNewsletter(testDb, actor(), parseSubscriberFilters({ q: "@batch.test" }), { batchSize });
      expect(result.rows).toBe(7);
      const rows = await rowsOf(result);
      expect(rows.map((line) => line.split(";")[0])).toEqual(expected.map((row) => row.email));
    }
  });

  it("streams every order once, newest number first, across batch boundaries", async () => {
    const result = await exportOrders(testDb, actor(), parseOrderFilters({}), { batchSize: 2 });
    const orders = await testDb.order.findMany({ where: { submittedAt: { not: null } }, orderBy: { number: "desc" }, select: { number: true, _count: { select: { items: true } } } });
    expect(orders.length).toBeGreaterThan(2);
    expect(result.rows).toBe(orders.length);
    const rows = await rowsOf(result);
    // One line per product, each order's lines together, orders in order.
    const expected = orders.flatMap((order) => Array.from({ length: Math.max(order._count.items, 1) }, () => formatOrderNumber(order.number)));
    expect(rows.map((line) => line.split(";")[0])).toEqual(expected);
  });

  it("streams every customer once, across batch boundaries", async () => {
    const result = await exportCustomers(testDb, actor(), parseUserFilters({}), { batchSize: 2 });
    const users = await testDb.user.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
    expect(users.length).toBeGreaterThan(2);
    expect(result.rows).toBe(users.length);
    expect((await rowsOf(result)).map((line) => line.split(";")[0])).toEqual(users.map((user) => user.id));
  });
});
