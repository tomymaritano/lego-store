import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { refresh, updateTag } from "next/cache";
import { listAdminReviews } from "@/lib/admin/reviews";
import { resetAndSeed, testDb } from "./setup/db";
import { enableMockPayments } from "./setup/checkout";

/*
 * The admin panel's Server Actions and data functions against the test
 * database, with Auth.js's auth() stubbed: who may call them (a visitor is
 * sent to log in, a customer gets the 403, the role always comes from the
 * database), what they validate, and what they expire in the catalogue
 * cache. Plus review moderation: any review, the rating recomputed, no
 * per-user edit limit.
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
const data = await import("@/lib/admin/data");

let customer: { id: string };
let admin: { id: string };

const signInAs = (user: { id: string } | null, tokenRole = "USER") => {
  session.current = user ? { user: { id: user.id, role: tokenRole }, sessionVersion: 0 } : null;
};

const productForm = (overrides: Record<string, string> = {}) => {
  const formData = new FormData();
  const values: Record<string, string> = {
    name: "Nave de Acción",
    price: "2100",
    originalPrice: "",
    isNew: "on",
    isOnSale: "",
    categoryId: "ships",
    type: "Set",
    age: "9+",
    theme: "Espacio",
    interests: "Naves",
    pieces: "501-1000",
    highlight: "Nuevo",
    img: "/images/lego.png",
    imageSecondary: "",
    images: "",
    stock: "4",
    shortDescription: "Corta.",
    description: "Larga.",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
};

beforeAll(async () => {
  await resetAndSeed();
  customer = await testDb.user.create({ data: { email: "cliente@acciones.test", name: "Cliente" } });
  admin = await testDb.user.create({ data: { email: "jefa@acciones.test", name: "Jefa", role: "ADMIN" } });
});

beforeEach(() => {
  signInAs(null);
  vi.mocked(updateTag).mockClear();
  vi.mocked(refresh).mockClear();
});

describe("who can use the admin panel", () => {
  const calls = {
    saveProductAction: () => actions.saveProductAction(null, {}, productForm()),
    updateStockAction: () => actions.updateStockAction("7", "1"),
    archiveProductAction: () => actions.archiveProductAction("7"),
    restoreProductAction: () => actions.restoreProductAction("7"),
    removeProductAction: () => actions.removeProductAction("7"),
    changeOrderStatusAction: () => actions.changeOrderStatusAction({ orderId: "x", to: "SHIPPED", expected: "PAID" }),
    deleteReviewAsAdminAction: () => actions.deleteReviewAsAdminAction("x"),
    getAdminDashboard: () => data.getAdminDashboard(),
    getAdminProducts: () => data.getAdminProducts({ q: "", category: "", status: "active", stock: "", page: 1 }),
    getAdminOrders: () => data.getAdminOrders({ status: "", q: "", from: "", to: "", page: 1 }),
    getAdminOrderDetail: () => data.getAdminOrderDetail("x"),
    getAdminReviews: () => data.getAdminReviews({ q: "", product: "", rating: null, page: 1 }),
  };

  it.each(Object.entries(calls))("%s: a visitor is sent to log in, a customer gets the 403", async (_name, call) => {
    await expect(call()).rejects.toThrow(/NEXT_REDIRECT \/login\?callbackUrl=%2Fadmin/);
    signInAs(customer);
    await expect(call()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    // A token claiming ADMIN does not make a customer one: the role comes from the database.
    signInAs(customer, "ADMIN");
    await expect(call()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await testDb.product.findUniqueOrThrow({ where: { id: "7" }, select: { stock: true, archivedAt: true } })).toMatchObject({
      archivedAt: null,
    });
  });
});

describe("product actions", () => {
  beforeEach(() => signInAs(admin));

  it("creating a product expires the catalogue tags and opens its edit page", async () => {
    let target = "";
    try {
      await actions.saveProductAction(null, {}, productForm());
    } catch (error) {
      target = (error as { url?: string }).url ?? "";
    }
    const product = await testDb.product.findFirstOrThrow({ where: { name: "Nave de Acción" } });
    expect(target).toBe(`/admin/products/${product.id}?created=1`);
    expect(product).toMatchObject({ price: 2100, isNew: true, isOnSale: false, stock: 4, images: ["/images/lego.png"] });
    expect(vi.mocked(updateTag).mock.calls.flat()).toEqual(expect.arrayContaining(["products", `product:${product.id}`, "categories"]));
  });

  it("returns field errors (and keeps the database as it was) for invalid input", async () => {
    const state = await actions.saveProductAction("7", {}, productForm({ price: "abc", img: "http://www.lego.com/cdn/x.png" }));
    expect(state).toMatchObject({ status: "error", fieldErrors: { price: expect.any(String), img: expect.any(String) } });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "7" } })).name).toBe("Batmobile");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("saving an edit refreshes the product's tags and the admin page", async () => {
    const state = await actions.saveProductAction("8", {}, productForm({ name: "Zombie Brickheadz", price: "120", categoryId: "brickheadz" }));
    expect(state).toMatchObject({ status: "success" });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "8" } })).price).toBe(120);
    expect(vi.mocked(updateTag).mock.calls.flat()).toEqual(expect.arrayContaining(["products", "product:8"]));
    expect(refresh).toHaveBeenCalled();
    expect(await actions.saveProductAction("no-such", {}, productForm())).toMatchObject({ status: "error" });
  });

  it("stock: validated (whole, not negative) and the product's tags expired", async () => {
    expect(await actions.updateStockAction("9", "-3")).toMatchObject({ ok: false });
    expect(await actions.updateStockAction("9", "2.5")).toMatchObject({ ok: false });
    expect(await actions.updateStockAction("9", "17")).toEqual({ ok: true, message: "Stock actualizado: 17." });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "9" } })).stock).toBe(17);
    expect(vi.mocked(updateTag).mock.calls.flat()).toEqual(expect.arrayContaining(["products", "product:9"]));
  });

  it("archive, restore and remove", async () => {
    expect(await actions.archiveProductAction("10")).toMatchObject({ ok: true });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "10" } })).archivedAt).not.toBeNull();
    expect(await actions.restoreProductAction("10")).toMatchObject({ ok: true });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "10" } })).archivedAt).toBeNull();
    // Seeded product 1 is in the seed's delivered orders: removing it archives it.
    expect(await actions.removeProductAction("1")).toMatchObject({ ok: true, removed: "archived" });
    await actions.restoreProductAction("1");
    expect(await actions.removeProductAction("no-such")).toMatchObject({ ok: false });
  });
});

describe("order actions", () => {
  beforeEach(() => signInAs(admin));

  it("validates the input and explains a refusal", async () => {
    expect(await actions.changeOrderStatusAction({ orderId: "x", to: "PAID", expected: "PENDING" })).toEqual({
      ok: false,
      error: "No entendimos ese cambio de estado.",
    });
    expect(await actions.changeOrderStatusAction({ orderId: "nope", to: "SHIPPED", expected: "PAID" })).toEqual({
      ok: false,
      error: "Ese pedido no existe.",
    });
    const delivered = await testDb.order.findFirstOrThrow({ where: { status: "DELIVERED" } });
    expect(await actions.changeOrderStatusAction({ orderId: delivered.id, to: "CANCELLED", expected: "DELIVERED" })).toEqual({
      ok: false,
      error: "Un pedido entregado no puede pasar a ese estado.",
    });
  });

  it("records the signed-in admin as the author of the change", async () => {
    const order = await testDb.order.create({
      data: {
        email: "envio@acciones.test",
        status: "PAID",
        paidAt: new Date(),
        submittedAt: new Date(),
        firstName: "Ana",
        lastName: "Pérez",
        phone: "1",
        address: "Calle 1",
        city: "CABA",
        state: "CABA",
        zipCode: "1000",
        country: "Argentina",
        subtotal: 100,
        shipping: 0,
        total: 100,
      },
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await actions.changeOrderStatusAction({ orderId: order.id, to: "SHIPPED", expected: "PAID" })).toEqual({
      ok: true,
      message: "Marcamos el pedido como enviado y le avisamos al cliente por email.",
    });
    info.mockRestore();
    const detail = await data.getAdminOrderDetail(order.id);
    expect(detail!.history).toEqual([expect.objectContaining({ from: "PAID", to: "SHIPPED", actorEmail: "jefa@acciones.test" })]);
  });
});

describe("review moderation", () => {
  it("an admin deletes anyone's review; the product's rating follows; no edit limit applies", async () => {
    signInAs(admin);
    const reviews = await listAdminReviews(testDb, { q: "", product: "13", rating: null, page: 1 });
    expect(reviews.total).toBeGreaterThan(0);
    const target = reviews.items[0]!;
    expect(target.product.id).toBe("13");

    expect(await actions.deleteReviewAsAdminAction(target.id)).toMatchObject({ ok: true });
    expect(await testDb.review.findUnique({ where: { id: target.id } })).toBeNull();
    const [product, stats] = await Promise.all([
      testDb.product.findUniqueOrThrow({ where: { id: "13" }, select: { rating: true, reviewCount: true } }),
      testDb.review.aggregate({ where: { productId: "13" }, _avg: { rating: true }, _count: true }),
    ]);
    expect(product.reviewCount).toBe(stats._count);
    expect(product.rating).toBe(stats._avg.rating === null ? 0 : Math.round(stats._avg.rating * 10) / 10);
    expect(vi.mocked(updateTag).mock.calls.flat()).toEqual(expect.arrayContaining(["products", "product:13"]));
    expect(await testDb.rateLimit.count({ where: { key: { startsWith: "review-edit:" } } })).toBe(0);
    expect(await actions.deleteReviewAsAdminAction(target.id)).toEqual({ ok: false, error: "Esa reseña ya no existe." });
  });

  it("lists by stars and text (author, title, product)", async () => {
    const fives = await listAdminReviews(testDb, { q: "", product: "", rating: 5, page: 1 });
    expect(fives.items.every((review) => review.rating === 5)).toBe(true);
    const byProduct = await listAdminReviews(testDb, { q: "millennium", product: "", rating: null, page: 1 });
    expect(byProduct.items.length).toBeGreaterThan(0);
    expect(byProduct.items.every((review) => review.product.id === "15" || /millennium/i.test(review.title + review.comment))).toBe(true);
  });
});
