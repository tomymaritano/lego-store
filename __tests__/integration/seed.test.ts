import { beforeEach, describe, expect, it, vi } from "vitest";
import { products as seedProducts } from "@/data/products";
import { categories as seedCategories } from "@/data/categories";
import { verifyPassword } from "@/lib/auth/password";
import { refreshProductRatings } from "@/lib/api/ratings";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";
import { handwrittenReviews, sampleUsers } from "../../prisma/seed/sample-reviews";
import { seedDatabase } from "../../prisma/seed/index";
import { DEV_ADMIN } from "../../prisma/seed/admin";
import { resetAndSeed, testDb } from "./setup/db";

beforeEach(async () => {
  await resetAndSeed();
});

const snapshot = async () => ({
  categories: await testDb.category.findMany({ orderBy: { id: "asc" }, omit: { updatedAt: true } }),
  products: await testDb.product.findMany({ orderBy: { id: "asc" }, omit: { updatedAt: true } }),
  reviews: await testDb.review.findMany({ orderBy: { id: "asc" }, omit: { updatedAt: true } }),
  helpful: await testDb.reviewHelpful.count(),
  users: await testDb.user.count(),
  orders: await testDb.order.findMany({ orderBy: { id: "asc" }, include: { items: { omit: { id: true } } }, omit: { updatedAt: true } }),
});

describe("seed", () => {
  it("writes every category and product from src/data, in order, with their ids", async () => {
    const categories = await testDb.category.findMany({ orderBy: { position: "asc" } });
    expect(categories.map((c) => c.id)).toEqual(seedCategories.map((c) => c.id));

    const products = await testDb.product.findMany({ orderBy: { createdAt: "asc" } });
    expect(products.map((p) => p.id)).toEqual(seedProducts.map((p) => p.id));
    for (const product of products) {
      const source = seedProducts.find((p) => p.id === product.id)!;
      expect(product).toMatchObject({ name: source.name, price: source.price, stock: source.stock, categoryId: source.category });
      expect(product.images.length).toBeGreaterThan(0);
      expect(product.img === PLACEHOLDER_IMAGE || product.img.startsWith("https://")).toBe(true);
      expect(product.searchName).toBe(product.searchName.toLowerCase());
    }
  });

  it("gives every product sample reviews whose cached average matches the catalogue rating", async () => {
    const products = await testDb.product.findMany({ include: { reviews: true } });
    for (const product of products) {
      expect(product.reviewCount).toBe(product.reviews.length);
      expect(product.reviewCount).toBeGreaterThanOrEqual(3);
      const average = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
      expect(product.rating).toBeCloseTo(Math.round(average * 10) / 10, 5);
      expect(product.rating).toBe(seedProducts.find((p) => p.id === product.id)!.rating);
    }
    // The hand-written reviews are there word for word.
    for (const review of handwrittenReviews) {
      expect(await testDb.review.count({ where: { productId: review.productId, title: review.title } })).toBe(1);
    }
  });

  it("backs 'compra verificada' with delivered orders, and only where the review says so", async () => {
    const purchased = async (email: string, productId: string) =>
      testDb.orderItem.count({ where: { productId, order: { status: "DELIVERED", user: { email } } } });
    const email = (key: string) => sampleUsers.find((u) => u.key === key)!.email;

    expect(await purchased(email("carlos"), "1")).toBe(1);
    expect(await purchased(email("roberto"), "3")).toBe(1);
    expect(await purchased(email("maria"), "4")).toBe(0);

    for (const order of await testDb.order.findMany({ include: { items: true } })) {
      const subtotal = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      expect(order.subtotal).toBe(subtotal);
      expect(order.total).toBe(order.subtotal + order.shipping);
    }
  });

  it("is idempotent", async () => {
    const before = await snapshot();
    await seedDatabase(testDb, { admin: null });
    expect(await snapshot()).toEqual(before);
  });

  it("leaves rows people created alone and counts their reviews", async () => {
    const user = await testDb.user.create({ data: { email: "nueva@example.com", name: "Nueva" } });
    await testDb.review.create({ data: { userId: user.id, productId: "8", rating: 1, title: "Mal", comment: "No me gustó." } });
    await seedDatabase(testDb, { admin: null });

    const product = await testDb.product.findUniqueOrThrow({ where: { id: "8" }, include: { reviews: true } });
    expect(product.reviews.some((r) => r.userId === user.id)).toBe(true);
    expect(product.reviewCount).toBe(product.reviews.length);
    expect(product.rating).toBeLessThan(seedProducts.find((p) => p.id === "8")!.rating);
  });

  it("creates the admin, and re-hashes the password only when it changes", async () => {
    await seedDatabase(testDb, { admin: { email: " Admin@Example.com ", password: "una-clave-segura" } });
    const admin = await testDb.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
    expect(admin.role).toBe("ADMIN");
    expect(await verifyPassword("una-clave-segura", admin.passwordHash!)).toBe(true);

    await seedDatabase(testDb, { admin: { email: "admin@example.com", password: "una-clave-segura" } });
    expect((await testDb.user.findUniqueOrThrow({ where: { email: "admin@example.com" } })).passwordHash).toBe(
      admin.passwordHash
    );

    await seedDatabase(testDb, { admin: { email: "admin@example.com", password: "otra-clave-segura" } });
    const changed = await testDb.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
    expect(await verifyPassword("otra-clave-segura", changed.passwordHash!)).toBe(true);

    await expect(seedDatabase(testDb, { admin: { email: "admin@example.com", password: "corta" } })).rejects.toThrow(
      /al menos 8/
    );
  });

  it("demotes the dev admin (public password) once a real admin is seeded", async () => {
    await seedDatabase(testDb, { admin: { ...DEV_ADMIN } });
    expect((await testDb.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } })).role).toBe("ADMIN");

    const log = vi.fn();
    await seedDatabase(testDb, { admin: { email: "owner@example.com", password: "una-clave-segura" }, log });
    const dev = await testDb.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
    expect(dev).toMatchObject({ role: "USER", passwordHash: null });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/ATENCIÓN: admin@lego-store\.local/));
    expect((await testDb.user.findUniqueOrThrow({ where: { email: "owner@example.com" } })).role).toBe("ADMIN");

    // Also without any admin (production without ADMIN_*), and quietly once it is already demoted.
    log.mockClear();
    await seedDatabase(testDb, { admin: null, log });
    expect(log).not.toHaveBeenCalledWith(expect.stringMatching(/ATENCIÓN/));
  });

  it("sample users cannot log in", async () => {
    const users = await testDb.user.findMany({ where: { email: { in: sampleUsers.map((u) => u.email) } } });
    expect(users).toHaveLength(sampleUsers.length);
    expect(users.every((u) => u.passwordHash === null && u.role === "USER")).toBe(true);
  });
});

describe("refreshProductRatings", () => {
  it("recomputes the cached rating for the given products, 0 without reviews", async () => {
    await testDb.review.deleteMany({ where: { productId: "2" } });
    await testDb.review.deleteMany({ where: { productId: "3", rating: { lt: 5 } } });
    // Untouched until refreshed.
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "2" } })).reviewCount).toBeGreaterThan(0);

    await refreshProductRatings(testDb, ["2", "3"]);
    expect(await testDb.product.findUniqueOrThrow({ where: { id: "2" } })).toMatchObject({ rating: 0, reviewCount: 0 });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: "3" } })).rating).toBe(5);

    await refreshProductRatings(testDb, []);
    await refreshProductRatings(testDb);
  });
});
