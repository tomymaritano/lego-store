import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NEWSLETTER_EXPORT_HEADER, ORDER_EXPORT_HEADER } from "@/lib/admin/exports";
import { unsubscribeUrl } from "@/lib/newsletter";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * The admin's CSV exports through their Route Handler against the test
 * database: admins only, UTF-8 with BOM, ";" separated, one line per order
 * product, the list's filters, formulas neutralised, and every export in
 * the audit log with its filters and row count.
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

const request = (kind: string, query = "") => GET(new NextRequest(new URL(`/api/admin/export/${kind}${query}`, "http://localhost")), { params: Promise.resolve({ kind }) });

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
    expect(entry).toMatchObject({ action: "export.orders", actorEmail: admin.email, changes: { filters: "q=formula@export.test", rows: 1 } });
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
