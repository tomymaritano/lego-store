import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import { getHomePicks } from "@/lib/api";
import { quoteCoupon } from "@/lib/coupons/server";
import { prepareOrder } from "@/lib/orders/checkout";
import { mockGateway } from "@/lib/payments/mock";
import { getStoreSettings, readShippingRules, readStoreSettings } from "@/lib/settings";
import { DEFAULT_STORE_SETTINGS } from "@/lib/settings/defaults";
import { prepareOrderSchema, type PrepareOrderInput } from "@/lib/validations/orders";
import { resetAndSeed, testDb } from "./setup/db";
import { enableMockPayments, shipping } from "./setup/checkout";

/*
 * The store's settings (/admin/configuracion) against the test database: the
 * seed's row, what the admin's actions validate, write and audit, the cache
 * tag they expire, and the server pricing orders and coupon quotes with the
 * shipping rule in the database at that moment.
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

enableMockPayments();

const actions = await import("@/lib/admin/actions");

let admin: { id: string; email: string };

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

const asAdmin = () => {
  session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
};

const guest = { userId: null, access: null };
const input = (lines: PrepareOrderInput["lines"]): PrepareOrderInput => prepareOrderSchema.parse({ shipping, lines, confirmationTokenId: "ctoken_mock_visa" });

const settingsEntries = () =>
  testDb.auditLog.findMany({ where: { entityType: "settings" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { action: true, changes: true, actorEmail: true } });

beforeAll(async () => {
  await resetAndSeed();
  admin = await testDb.user.create({ data: { email: "jefa@config.test", role: "ADMIN" }, select: { id: true, email: true } });
});

beforeEach(() => {
  session.current = null;
  vi.mocked(updateTag).mockClear();
});

describe("the settings row", () => {
  it("is seeded with the defaults and the home page's picks, in order", async () => {
    expect(await getStoreSettings()).toEqual(DEFAULT_STORE_SETTINGS);
    expect((await getHomePicks()).map((product) => product.id)).toEqual(["15", "12", "11", "4"]);
  });

  it("falls back to the defaults while it is missing", async () => {
    const row = await testDb.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    await testDb.storeSettings.delete({ where: { id: 1 } });
    try {
      expect(await readStoreSettings(testDb)).toEqual(DEFAULT_STORE_SETTINGS);
      expect(await readShippingRules(testDb)).toEqual({ cost: 299, freeFrom: 5000 });
    } finally {
      await testDb.storeSettings.create({ data: row });
    }
  });

  it("is a single row whose shipping cost is never free (check constraints)", async () => {
    await expect(testDb.storeSettings.create({ data: { ...(await testDb.storeSettings.findUniqueOrThrow({ where: { id: 1 } })), id: 2 } })).rejects.toThrow();
    await expect(testDb.storeSettings.update({ where: { id: 1 }, data: { shippingCost: 0 } })).rejects.toThrow();
  });
});

describe("the admin's actions", () => {
  it("are for admins only", async () => {
    await expect(actions.saveShippingSettingsAction({}, form({ shippingCost: "1", freeShippingFrom: "1" }))).rejects.toThrow(/NEXT_REDIRECT \/login/);
    const customer = await testDb.user.create({ data: { email: "cliente@config.test" } });
    session.current = { user: { id: customer.id, role: "ADMIN" }, sessionVersion: 0 };
    await expect(actions.saveFeaturedProductsAction([])).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await testDb.storeSettings.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({ shippingCost: 299 });
  });

  it("validate every field on the server", async () => {
    asAdmin();
    expect(await actions.saveShippingSettingsAction({}, form({ shippingCost: "0", freeShippingFrom: "5.000" }))).toMatchObject({
      status: "error",
      fieldErrors: { shippingCost: expect.any(String), freeShippingFrom: expect.any(String) },
    });
    expect(
      await actions.saveAnnouncementSettingsAction(
        {},
        form({ announcementActive: "on", announcementText: "", announcementLinkUrl: "javascript:alert(1)", announcementLinkLabel: "", announcementTone: "#ff0000" })
      )
    ).toMatchObject({
      status: "error",
      fieldErrors: { announcementText: expect.any(String), announcementLinkUrl: expect.any(String), announcementTone: expect.any(String) },
    });
    expect(
      await actions.saveContactSettingsAction({}, form({ contactEmail: "no-es-un-email", contactPhone: "llamanos", contactAddress: "", contactHours: "x", socialX: "http://x.com/lego" }))
    ).toMatchObject({
      status: "error",
      fieldErrors: { contactEmail: expect.any(String), contactPhone: expect.any(String), contactAddress: expect.any(String), socialX: expect.any(String) },
    });
    expect(await settingsEntries()).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("save a section, record what changed and expire the settings tag", async () => {
    asAdmin();
    const saved = await actions.saveAnnouncementSettingsAction(
      {},
      form({ announcementActive: "on", announcementText: "Cuotas sin interés este fin de semana", announcementLinkUrl: "/search?onSale=1", announcementLinkLabel: "Ver ofertas", announcementTone: "INFO" })
    );
    expect(saved).toMatchObject({ status: "success" });
    expect(vi.mocked(updateTag).mock.calls.flat()).toContain("settings");
    expect((await getStoreSettings()).announcement).toEqual({
      active: true,
      text: "Cuotas sin interés este fin de semana",
      linkUrl: "/search?onSale=1",
      linkLabel: "Ver ofertas",
      tone: "INFO",
    });
    const [entry] = await settingsEntries();
    expect(entry).toMatchObject({
      action: "settings.announcement",
      actorEmail: admin.email,
      changes: {
        announcementText: [DEFAULT_STORE_SETTINGS.announcement.text, "Cuotas sin interés este fin de semana"],
        announcementTone: ["BRAND", "INFO"],
        announcementLinkUrl: ["/envios", "/search?onSale=1"],
        announcementLinkLabel: ["Ver condiciones", "Ver ofertas"],
      },
    });

    // The same values again: nothing to write, nothing to expire.
    vi.mocked(updateTag).mockClear();
    const again = await actions.saveAnnouncementSettingsAction(
      {},
      form({ announcementActive: "on", announcementText: "Cuotas sin interés este fin de semana", announcementLinkUrl: "/search?onSale=1", announcementLinkLabel: "Ver ofertas", announcementTone: "INFO" })
    );
    expect(again).toEqual({ status: "success", message: "No había cambios para guardar." });
    expect(updateTag).not.toHaveBeenCalled();
    expect(await settingsEntries()).toHaveLength(1);
  });

  it("put the featured products in the admin's order, refusing archived ones", async () => {
    asAdmin();
    await testDb.product.update({ where: { id: "22" }, data: { archivedAt: new Date() } });
    try {
      expect(await actions.saveFeaturedProductsAction(["7", "22"])).toMatchObject({ ok: false });
      expect(await actions.saveFeaturedProductsAction(["7", "7"])).toMatchObject({ ok: false, error: "Hay un producto repetido" });
      expect(await actions.saveFeaturedProductsAction(["7", "1", "15"])).toMatchObject({ ok: true });
      expect((await getHomePicks()).map((product) => product.id)).toEqual(["7", "1", "15"]);
      expect(vi.mocked(updateTag).mock.calls.flat()).toContain("settings");
      const entry = (await settingsEntries()).at(-1);
      expect(entry).toMatchObject({ action: "settings.featured", changes: { featured: [["15", "12", "11", "4"], ["7", "1", "15"]] } });

      // An archived pick drops off the home page without anyone editing the list.
      await testDb.product.update({ where: { id: "1" }, data: { archivedAt: new Date() } });
      expect((await getHomePicks()).map((product) => product.id)).toEqual(["7", "15"]);
    } finally {
      await testDb.product.updateMany({ where: { id: { in: ["1", "22"] } }, data: { archivedAt: null } });
    }
  });
});

describe("prices follow the shipping setting", () => {
  it("in new orders and in the coupon quote, from the moment it is saved", async () => {
    const cheap = await testDb.product.findUniqueOrThrow({ where: { id: "20" }, select: { price: true } });
    const before = await prepareOrder(testDb, mockGateway(), input([{ productId: "20", quantity: 1 }]), guest);
    expect(before).toMatchObject({ ok: true, order: { shipping: 299, total: cheap.price + 299 } });

    asAdmin();
    expect(await actions.saveShippingSettingsAction({}, form({ shippingCost: "450", freeShippingFrom: "8000" }))).toMatchObject({ status: "success" });
    const [entry] = (await settingsEntries()).filter((row) => row.action === "settings.shipping");
    expect(entry).toMatchObject({ changes: { shippingCost: [299, 450], freeShippingFrom: [5000, 8000] } });

    const after = await prepareOrder(testDb, mockGateway(), input([{ productId: "20", quantity: 1 }]), guest);
    expect(after).toMatchObject({ ok: true, order: { shipping: 450, total: cheap.price + 450 } });
    // The Ferrari (#13, $5.499) shipped free from $5.000; under the new $8.000 threshold it pays shipping.
    const ferrari = await testDb.product.findUniqueOrThrow({ where: { id: "13" }, select: { price: true } });
    const priced = await prepareOrder(testDb, mockGateway(), input([{ productId: "13", quantity: 1 }]), guest);
    expect(priced).toMatchObject({ ok: true, order: { shipping: 450, total: ferrari.price + 450 } });

    const quote = await quoteCoupon(testDb, { code: "LEGO500", lines: [{ productId: "13", quantity: 1 }], userId: null });
    expect(quote).toMatchObject({ ok: true, quote: { totals: { subtotal: ferrari.price, discount: 500, shipping: 450, total: ferrari.price - 500 + 450 } } });

    // Free from $1: every order ships free.
    expect(await actions.saveShippingSettingsAction({}, form({ shippingCost: "450", freeShippingFrom: "1" }))).toMatchObject({ status: "success" });
    expect(await prepareOrder(testDb, mockGateway(), input([{ productId: "20", quantity: 1 }]), guest)).toMatchObject({
      ok: true,
      order: { shipping: 0, total: cheap.price },
    });
  });
});
