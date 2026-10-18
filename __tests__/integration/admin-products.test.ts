import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as catalog from "@/lib/api/catalog";
import { getCategories, getPaginatedProducts, getProductById, getProductsByIds, searchProducts } from "@/lib/api";
import {
  archiveProduct,
  createProduct,
  getAdminProduct,
  listAdminProducts,
  removeProduct,
  restoreProduct,
  setProductStock,
  updateProduct,
} from "@/lib/admin/products";
import { addToCart, getCart, mergeCart } from "@/lib/lists/cart";
import { addToWishlist, getWishlist } from "@/lib/lists/wishlist";
import { prepareOrder } from "@/lib/orders/checkout";
import { mockGateway } from "@/lib/payments/mock";
import { createReview } from "@/lib/reviews/mutations";
import { productFormSchema, type ProductFormInput } from "@/lib/validations/admin";
import { prepareOrderSchema } from "@/lib/validations/orders";
import { resetAndSeed, testDb } from "./setup/db";
import { shipping } from "./setup/checkout";

/*
 * The admin's catalogue writes against the test database, read back through
 * the storefront's own gateway (src/lib/api, its cache a pass-through here):
 * a new product is on sale at once and searchable, an edit shows everywhere,
 * archiving takes a product off the store (catalogue, search, carts,
 * wishlists, checkout, reviews) without touching its orders, and deleting
 * only deletes what no order references.
 */

const form = (overrides: Partial<ProductFormInput> = {}): ProductFormInput => ({
  name: "Torre de Prueba",
  price: "1500",
  originalPrice: "",
  isNew: true,
  isOnSale: false,
  categoryId: "buildings",
  type: "Set",
  age: "12+",
  theme: "Arquitectura Ñandú",
  interests: "Edificios, Viajes, Edificios",
  pieces: "501-1000",
  highlight: "Exclusivo",
  img: "https://www.lego.com/cdn/cs/set/assets/blt0000/torre.png",
  imageSecondary: "",
  images: "",
  stock: "12",
  shortDescription: "Una torre para probar.",
  description: "Una torre de prueba con una descripción larga.",
  ...overrides,
});

const parse = (overrides?: Partial<ProductFormInput>) => productFormSchema.parse(form(overrides));

let ana: { id: string };

beforeAll(async () => {
  await resetAndSeed();
  ana = await testDb.user.create({ data: { email: "ana@productos.test", name: "Ana" } });
});

beforeEach(async () => {
  await testDb.cartItem.deleteMany({ where: { userId: ana.id } });
  await testDb.wishlistItem.deleteMany({ where: { userId: ana.id } });
});

describe("productFormSchema", () => {
  it("normalises the form: numbers, lists, gallery defaulting to the main picture, no original price off sale", () => {
    expect(parse({ originalPrice: "9999" })).toMatchObject({
      price: 1500,
      originalPrice: null,
      interests: ["Edificios", "Viajes"],
      images: ["https://www.lego.com/cdn/cs/set/assets/blt0000/torre.png"],
      imageSecondary: null,
      stock: 12,
    });
  });

  it("explains each problem on its field", () => {
    const result = productFormSchema.safeParse(
      form({ name: " ", price: "12.5", isOnSale: true, originalPrice: "1000", img: "https://evil.example.com/x.png", stock: "-1" })
    );
    expect(result.success).toBe(false);
    const errors = Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]));
    expect(errors).toMatchObject({
      name: "Completa el nombre",
      price: "Tiene que ser un número entero, sin puntos ni signos",
      img: expect.stringContaining("www.lego.com"),
      stock: "Tiene que ser un número entero, sin puntos ni signos",
    });
  });

  it("a product on sale needs an original price above its price", () => {
    const missing = productFormSchema.safeParse(form({ isOnSale: true }));
    expect(missing.error?.issues[0]).toMatchObject({ path: ["originalPrice"], message: "Un producto en oferta necesita el precio anterior" });
    const lower = productFormSchema.safeParse(form({ isOnSale: true, originalPrice: "1500" }));
    expect(lower.error?.issues[0]).toMatchObject({ path: ["originalPrice"], message: "Tiene que ser mayor que el precio actual" });
    expect(parse({ isOnSale: true, originalPrice: "1999" })).toMatchObject({ isOnSale: true, originalPrice: 1999 });
  });
});

describe("creating and editing", () => {
  it("a new product is on the store at once: its page, its category, search (accents ignored) and the admin list", async () => {
    const before = (await getCategories()).find((category) => category.id === "buildings")!.productCount;
    const created = await createProduct(testDb, parse());
    expect(created.ok).toBe(true);
    const id = (created as { productId: string }).productId;

    expect(await getProductById(id)).toMatchObject({ name: "Torre de Prueba", price: 1500, category: "buildings", stock: 12, rating: 0 });
    expect((await getCategories()).find((category) => category.id === "buildings")!.productCount).toBe(before + 1);
    expect((await searchProducts("nandu torre")).map((product) => product.id)).toEqual([id]);
    const admin = await listAdminProducts(testDb, { q: "torre de prueba", category: "", status: "active", stock: "", page: 1 });
    expect(admin.items.map((product) => product.id)).toEqual([id]);
    expect((await listAdminProducts(testDb, { q: id, category: "", status: "all", stock: "", page: 1 })).items).toHaveLength(1);
  });

  it("rejects an unknown category on its field", async () => {
    expect(await createProduct(testDb, parse({ categoryId: "no-existe" }))).toEqual({
      ok: false,
      reason: "invalid",
      fieldErrors: { categoryId: "Esa categoría no existe" },
    });
  });

  it("an edit rewrites every field and the search columns", async () => {
    const result = await updateProduct(
      testDb,
      "14",
      parse({ name: "Taj Mahal Edición Admin", price: "3799", isOnSale: true, originalPrice: "3999", categoryId: "buildings", stock: "7" })
    );
    expect(result).toEqual({ ok: true, productId: "14" });
    expect(await getProductById("14")).toMatchObject({ name: "Taj Mahal Edición Admin", price: 3799, originalPrice: 3999, isOnSale: true, stock: 7 });
    expect((await searchProducts("edicion admin")).map((product) => product.id)).toEqual(["14"]);
    // Rating and reviews are not form fields: untouched.
    expect((await getAdminProduct(testDb, "14"))!.reviewCount).toBeGreaterThan(0);
    expect(await updateProduct(testDb, "no-such-product", parse())).toEqual({ ok: false, reason: "not_found" });
  });

  it("quick stock edit; filters for low and sold-out stock", async () => {
    expect(await setProductStock(testDb, "13", 0)).toBe(true);
    expect(await setProductStock(testDb, "12", 3)).toBe(true);
    expect(await setProductStock(testDb, "nope", 3)).toBe(false);
    const out = await listAdminProducts(testDb, { q: "", category: "", status: "active", stock: "out", page: 1 });
    expect(out.items.map((product) => product.id)).toContain("13");
    expect(out.items.every((product) => product.stock === 0)).toBe(true);
    const low = await listAdminProducts(testDb, { q: "", category: "", status: "active", stock: "low", page: 1 });
    expect(low.items.map((product) => product.id)).toContain("12");
    expect(low.items.every((product) => product.stock > 0 && product.stock <= 5)).toBe(true);
  });

  it("pages of 20, the page clamped to the last one", async () => {
    const all = await listAdminProducts(testDb, { q: "", category: "", status: "all", stock: "", page: 1 });
    expect(all.items).toHaveLength(20);
    const last = await listAdminProducts(testDb, { q: "", category: "", status: "all", stock: "", page: 99 });
    expect(last.page).toBe(all.totalPages);
    expect(last.items.length).toBe(all.total - 20 * (all.totalPages - 1));
  });
});

describe("archiving", () => {
  it("takes the product off the store and out of carts and wishlists; restoring brings it back", async () => {
    await addToCart(testDb, ana.id, "11", 1);
    await addToCart(testDb, ana.id, "7", 1);
    await addToWishlist(testDb, ana.id, "11");
    const before = (await getCategories()).find((category) => category.id === "cars")!.productCount;

    expect(await archiveProduct(testDb, "11")).toBe(true);
    expect(await getProductById("11")).toBeNull();
    expect(await getProductsByIds(["11", "7"])).toHaveLength(1);
    expect((await searchProducts("porsche")).map((product) => product.id)).not.toContain("11");
    expect((await getPaginatedProducts({ limit: 100 })).items.map((product) => product.id)).not.toContain("11");
    expect((await catalog.getFilterOptions(testDb, {})).total).toBe((await catalog.getProducts(testDb)).length);
    expect((await getCategories()).find((category) => category.id === "cars")!.productCount).toBe(before - 1);
    expect((await getCart(testDb, ana.id)).map((line) => line.id)).toEqual(["7"]);
    expect(await getWishlist(testDb, ana.id)).toEqual([]);

    // Nobody can put it back: carts, wishlists, login merges, checkout, reviews.
    expect(await addToCart(testDb, ana.id, "11", 1)).toEqual({ ok: false, reason: "not_found" });
    expect(await addToWishlist(testDb, ana.id, "11")).toBeNull();
    expect((await mergeCart(testDb, ana.id, [{ productId: "11", quantity: 1 }])).map((line) => line.id)).toEqual(["7"]);
    const checkout = await prepareOrder(
      testDb,
      mockGateway(),
      prepareOrderSchema.parse({ shipping, lines: [{ productId: "11", quantity: 1 }], confirmationTokenId: "ctoken_mock_visa" }),
      { userId: null, access: null }
    );
    expect(checkout).toEqual({ ok: false, code: "unavailable", unavailable: [{ productId: "11", name: null, available: 0 }] });
    expect(await createReview(testDb, ana.id, "11", { rating: 5, title: "Hola", comment: "Una reseña cualquiera." })).toEqual({
      ok: false,
      reason: "not_found",
    });
    // The admin still sees it, as archived.
    const archived = await listAdminProducts(testDb, { q: "", category: "", status: "archived", stock: "", page: 1 });
    expect(archived.items.map((product) => [product.id, product.archived])).toEqual([["11", true]]);

    expect(await restoreProduct(testDb, "11")).toBe(true);
    expect(await getProductById("11")).toMatchObject({ id: "11" });
    expect(await archiveProduct(testDb, "nope")).toBe(false);
  });
});

describe("removeProduct", () => {
  it("deletes a product nobody ordered, with its reviews and list lines", async () => {
    const created = (await createProduct(testDb, parse({ name: "Para borrar" }))) as { productId: string };
    await addToCart(testDb, ana.id, created.productId, 1);
    await createReview(testDb, ana.id, created.productId, { rating: 4, title: "Bien", comment: "Me gustó bastante." });

    expect(await removeProduct(testDb, created.productId)).toEqual({ result: "deleted" });
    expect(await testDb.product.findUnique({ where: { id: created.productId } })).toBeNull();
    expect(await testDb.review.count({ where: { productId: created.productId } })).toBe(0);
    expect(await getCart(testDb, ana.id)).toEqual([]);
    expect(await removeProduct(testDb, created.productId)).toEqual({ result: "not_found" });
  });

  it("archives a product that orders reference instead: the order keeps its line and link", async () => {
    const created = (await createProduct(testDb, parse({ name: "Vendido una vez" }))) as { productId: string };
    const order = await testDb.order.create({
      data: {
        email: "compra@productos.test",
        status: "DELIVERED",
        firstName: "Ana",
        lastName: "Pérez",
        phone: "1",
        address: "Calle 1",
        city: "CABA",
        state: "CABA",
        zipCode: "1000",
        country: "Argentina",
        subtotal: 1500,
        shipping: 0,
        total: 1500,
        items: { create: { productId: created.productId, name: "Vendido una vez", unitPrice: 1500, image: "/images/lego.png", quantity: 1 } },
      },
    });

    expect(await removeProduct(testDb, created.productId)).toEqual({ result: "archived", orderLines: 1 });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: created.productId } })).archivedAt).not.toBeNull();
    expect(await getProductById(created.productId)).toBeNull();
    expect(await testDb.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).toMatchObject({ productId: created.productId });
    expect((await getAdminProduct(testDb, created.productId))!.orderLines).toBe(1);
  });
});
