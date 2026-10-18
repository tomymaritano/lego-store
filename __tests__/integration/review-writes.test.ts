import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import { NextRequest } from "next/server";
import { getReviewPage } from "@/lib/api";
import { updateUserName } from "@/lib/auth/accounts";
import { createReview, deleteReview, setHelpful, updateReview } from "@/lib/reviews/mutations";
import { REVIEW_PAGE_SIZE } from "@/lib/reviews/sorts";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * Reviews on the server against the test database: one per user and product,
 * "compra verificada", the cached rating kept in step in the same
 * transaction, "útil" once per user, ownership, the rate limit, cache
 * invalidation, and the list (sort, pages) and viewer Route Handlers.
 * Auth.js's auth() is stubbed with the session under test.
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});

const actions = await import("@/lib/reviews/actions");
const { GET: listRoute } = await import("@/app/api/products/[productId]/reviews/route");
const { GET: mineRoute } = await import("@/app/api/products/[productId]/reviews/mine/route");

/** A product nobody has reviewed in these tests' setup (its seeded reviews are removed). */
const PRODUCT = "7";
const content = { rating: 4, title: "Muy bueno", comment: "Se arma rápido y queda espectacular." };

let ana: { id: string };
let bruno: { id: string };
let admin: { id: string };

const signInAs = (user: { id: string } | null) => {
  session.current = user ? { user: { id: user.id, role: "USER" }, sessionVersion: 0 } : null;
};

async function placeOrder(userId: string | null, status: "PENDING" | "PAID" | "DELIVERED" | "CANCELLED", productId = PRODUCT) {
  const product = await testDb.product.findUniqueOrThrow({ where: { id: productId } });
  return testDb.order.create({
    data: {
      userId,
      email: "comprador@resenas.test",
      status,
      firstName: "Ana",
      lastName: "Pérez",
      phone: "1122334455",
      address: "Calle 123",
      city: "CABA",
      state: "CABA",
      zipCode: "1000",
      country: "Argentina",
      subtotal: product.price,
      shipping: 0,
      total: product.price,
      items: { create: { productId, name: product.name, unitPrice: product.price, image: product.img, quantity: 1 } },
    },
  });
}

async function expectRatingMatchesReviews(productId = PRODUCT) {
  const [product, stats] = await Promise.all([
    testDb.product.findUniqueOrThrow({ where: { id: productId }, select: { rating: true, reviewCount: true } }),
    testDb.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: true }),
  ]);
  expect(product.reviewCount).toBe(stats._count);
  expect(product.rating).toBe(stats._avg.rating === null ? 0 : Math.round(stats._avg.rating * 10) / 10);
}

const list = (productId: string, query = "") =>
  listRoute(new NextRequest(new URL(`/api/products/${productId}/reviews${query}`, "http://localhost")), {
    params: Promise.resolve({ productId }),
  });
const mine = (productId: string) => mineRoute(new Request("http://localhost"), { params: Promise.resolve({ productId }) });

beforeAll(async () => {
  await resetAndSeed();
  ana = await testDb.user.create({ data: { email: "ana@resenas.test", name: "Ana Pérez" } });
  bruno = await testDb.user.create({ data: { email: "bruno@resenas.test", name: "Bruno" } });
  admin = await testDb.user.create({ data: { email: "jefa@resenas.test", name: "Jefa", role: "ADMIN" } });
});

beforeEach(async () => {
  signInAs(null);
  vi.mocked(updateTag).mockClear();
  await testDb.review.deleteMany({ where: { productId: PRODUCT } });
  await testDb.review.deleteMany({ where: { userId: { in: [ana.id, bruno.id, admin.id] } } });
  await testDb.order.deleteMany({ where: { email: "comprador@resenas.test" } });
  await testDb.rateLimit.deleteMany();
  await testDb.$executeRaw`UPDATE "Product" SET "rating" = 0, "reviewCount" = 0 WHERE "id" = ${PRODUCT}`;
});

describe("createReview", () => {
  it("creates one review per user and product, and updates the cached rating in the same transaction", async () => {
    expect(await createReview(testDb, ana.id, PRODUCT, { ...content, rating: 5 })).toMatchObject({ ok: true, productId: PRODUCT });
    expect(await createReview(testDb, bruno.id, PRODUCT, { ...content, rating: 2 })).toMatchObject({ ok: true });
    await expectRatingMatchesReviews();
    expect(await testDb.product.findUniqueOrThrow({ where: { id: PRODUCT } })).toMatchObject({ rating: 3.5, reviewCount: 2 });

    expect(await createReview(testDb, ana.id, PRODUCT, content)).toEqual({ ok: false, reason: "duplicate" });
    expect(await testDb.review.count({ where: { productId: PRODUCT } })).toBe(2);
  });

  it("keeps one review when two submissions race", async () => {
    const results = await Promise.all([1, 2, 3].map(() => createReview(testDb, ana.id, PRODUCT, content)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, reason: "duplicate" },
      { ok: false, reason: "duplicate" },
    ]);
    await expectRatingMatchesReviews();
  });

  it("refuses an unknown product", async () => {
    expect(await createReview(testDb, ana.id, "nope", content)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("compra verificada", () => {
  it("only for the author's own paid, shipped or delivered order with the product", async () => {
    await createReview(testDb, ana.id, PRODUCT, content);
    await createReview(testDb, bruno.id, PRODUCT, content);
    const verified = async () =>
      Object.fromEntries((await getReviewPage(PRODUCT, "recent"))!.items.map((r) => [r.userName, r.verified]));

    // Pending and cancelled orders, a guest order and an order of another product do not count.
    await placeOrder(ana.id, "PENDING");
    await placeOrder(ana.id, "CANCELLED");
    await placeOrder(null, "PAID");
    await placeOrder(bruno.id, "DELIVERED", "1");
    expect(await verified()).toEqual({ "Ana Pérez": false, Bruno: false });

    await placeOrder(ana.id, "PAID");
    expect(await verified()).toEqual({ "Ana Pérez": true, Bruno: false });
    await placeOrder(bruno.id, "DELIVERED");
    expect(await verified()).toEqual({ "Ana Pérez": true, Bruno: true });
  });
});

describe("updateReview and deleteReview", () => {
  it("edit their own review and recompute the rating", async () => {
    const created = await createReview(testDb, ana.id, PRODUCT, { ...content, rating: 5 });
    if (!created.ok) throw new Error("not created");
    await createReview(testDb, bruno.id, PRODUCT, { ...content, rating: 1 });

    expect(await updateReview(testDb, ana.id, created.reviewId, { ...content, rating: 3, title: "Bien" })).toMatchObject({ ok: true });
    expect(await testDb.review.findUniqueOrThrow({ where: { id: created.reviewId } })).toMatchObject({ rating: 3, title: "Bien" });
    await expectRatingMatchesReviews();

    expect(await deleteReview(testDb, { id: ana.id, role: "USER" }, created.reviewId)).toMatchObject({ ok: true });
    await expectRatingMatchesReviews();
    expect(await testDb.product.findUniqueOrThrow({ where: { id: PRODUCT } })).toMatchObject({ rating: 1, reviewCount: 1 });
  });

  it("cannot edit or delete someone else's review (it reads as not found)", async () => {
    const created = await createReview(testDb, ana.id, PRODUCT, content);
    if (!created.ok) throw new Error("not created");
    expect(await updateReview(testDb, bruno.id, created.reviewId, { ...content, title: "Hackeada" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await deleteReview(testDb, { id: bruno.id, role: "USER" }, created.reviewId)).toEqual({ ok: false, reason: "not_found" });
    expect(await testDb.review.findUniqueOrThrow({ where: { id: created.reviewId } })).toMatchObject({ title: content.title });
  });

  it("an admin can delete any review (moderation)", async () => {
    const created = await createReview(testDb, ana.id, PRODUCT, content);
    if (!created.ok) throw new Error("not created");
    expect(await deleteReview(testDb, { id: admin.id, role: "ADMIN" }, created.reviewId)).toMatchObject({ ok: true });
    await expectRatingMatchesReviews();
  });
});

describe("setHelpful", () => {
  it("counts each user once, toggles off, and is idempotent", async () => {
    const created = await createReview(testDb, ana.id, PRODUCT, content);
    if (!created.ok) throw new Error("not created");

    expect(await setHelpful(testDb, bruno.id, created.reviewId, true)).toMatchObject({ ok: true, voted: true, helpful: 1 });
    expect(await setHelpful(testDb, bruno.id, created.reviewId, true)).toMatchObject({ ok: true, helpful: 1 });
    expect(await setHelpful(testDb, admin.id, created.reviewId, true)).toMatchObject({ ok: true, helpful: 2 });
    expect(await setHelpful(testDb, bruno.id, created.reviewId, false)).toMatchObject({ ok: true, voted: false, helpful: 1 });
  });

  it("refuses votes on one's own review and on unknown reviews", async () => {
    const created = await createReview(testDb, ana.id, PRODUCT, content);
    if (!created.ok) throw new Error("not created");
    expect(await setHelpful(testDb, ana.id, created.reviewId, true)).toEqual({ ok: false, reason: "own_review" });
    expect(await setHelpful(testDb, ana.id, "nope", true)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("review Server Actions", () => {
  it("require a session", async () => {
    expect(await actions.createReviewAction(PRODUCT, content)).toMatchObject({ ok: false });
    expect(await actions.setHelpfulAction("x", true)).toMatchObject({ ok: false });
    expect(await testDb.review.count({ where: { productId: PRODUCT } })).toBe(0);
  });

  it("validate with the form's schema and return Spanish field errors", async () => {
    signInAs(ana);
    const result = await actions.createReviewAction(PRODUCT, { rating: 9, title: "x", comment: "corto" });
    expect(result).toEqual({
      ok: false,
      error: "Revisa los datos de tu reseña.",
      fieldErrors: {
        rating: "Elige una calificación de 1 a 5 estrellas",
        title: "Escribe un título (al menos 3 caracteres)",
        comment: "Cuéntanos un poco más (al menos 10 caracteres)",
      },
    });
  });

  it("publish, then refresh the product's cache tags so the page re-renders with the new rating", async () => {
    signInAs(ana);
    expect(await actions.createReviewAction(PRODUCT, content)).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("products");
    expect(updateTag).toHaveBeenCalledWith(`product:${PRODUCT}`);
    expect(await actions.createReviewAction(PRODUCT, content)).toEqual({
      ok: false,
      error: "Ya publicaste una reseña de este producto. Puedes editarla.",
    });
  });

  it("a 'útil' vote refreshes only the product's own tag", async () => {
    const created = await createReview(testDb, ana.id, PRODUCT, content);
    if (!created.ok) throw new Error("not created");
    signInAs(bruno);
    expect(await actions.setHelpfulAction(created.reviewId, true)).toEqual({ ok: true, voted: true, helpful: 1 });
    expect(updateTag).toHaveBeenCalledWith(`product:${PRODUCT}`);
    expect(updateTag).not.toHaveBeenCalledWith("products");
  });

  it("cannot edit or delete another user's review", async () => {
    const created = await createReview(testDb, ana.id, PRODUCT, content);
    if (!created.ok) throw new Error("not created");
    signInAs(bruno);
    expect(await actions.updateReviewAction(created.reviewId, content)).toMatchObject({ ok: false });
    expect(await actions.deleteReviewAction(created.reviewId)).toMatchObject({ ok: false });
    expect(updateTag).not.toHaveBeenCalled();
    expect(await testDb.review.count({ where: { id: created.reviewId } })).toBe(1);
  });

  it("rate-limit review creation per user", async () => {
    signInAs(ana);
    const products = (await testDb.product.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 12 })).map((p) => p.id);
    const results = [];
    for (const id of products.slice(0, 11)) results.push(await actions.createReviewAction(id, content));
    expect(results.slice(0, 10).every((r) => r.ok)).toBe(true);
    expect(results[10]).toMatchObject({ ok: false, error: expect.stringMatching(/^Publicaste muchas reseñas seguidas/) });
  });

  it("an edit that keeps the rating refreshes only the product's own tag; one that moves it, the listings too", async () => {
    signInAs(ana);
    await actions.createReviewAction(PRODUCT, content);
    const { id } = await testDb.review.findFirstOrThrow({ where: { userId: ana.id, productId: PRODUCT } });
    vi.mocked(updateTag).mockClear();

    expect(await actions.updateReviewAction(id, { ...content, title: "Otro título" })).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith(`product:${PRODUCT}`);
    expect(updateTag).not.toHaveBeenCalledWith("products");

    vi.mocked(updateTag).mockClear();
    expect(await actions.updateReviewAction(id, { ...content, rating: 2 })).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("products");
    await expectRatingMatchesReviews();
  });

  it("rate-limit edits and deletions per user", async () => {
    signInAs(ana);
    await actions.createReviewAction(PRODUCT, content);
    const { id } = await testDb.review.findFirstOrThrow({ where: { userId: ana.id, productId: PRODUCT } });
    const results = [];
    for (let i = 0; i < 21; i++) results.push(await actions.updateReviewAction(id, { ...content, title: `Edición ${i}` }));
    expect(results.slice(0, 20).every((r) => r.ok)).toBe(true);
    expect(results[20]).toMatchObject({ ok: false, error: expect.stringMatching(/^Hiciste muchos cambios seguidos/) });
    expect(await actions.deleteReviewAction(id)).toMatchObject({ ok: false, error: expect.stringMatching(/^Hiciste muchos cambios/) });
    expect(await testDb.review.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: "Edición 19" });
  });
});

describe("renaming the account", () => {
  it("returns the products the user reviewed when the name changes (their cached review lists show it)", async () => {
    await createReview(testDb, ana.id, PRODUCT, content);
    expect(await updateUserName(ana.id, "Ana María Pérez")).toEqual({ reviewedProductIds: [PRODUCT] });
    // Same name again: nothing to refresh.
    expect(await updateUserName(ana.id, " Ana María Pérez ")).toEqual({ reviewedProductIds: [] });
    await updateUserName(ana.id, "Ana Pérez");
  });
});

describe("GET /api/products/<id>/reviews", () => {
  it("pages and sorts on the server, with a summary over every review", async () => {
    const product = "1";
    const total = await testDb.review.count({ where: { productId: product } });
    const first = await (await list(product)).json();
    expect(first).toMatchObject({ page: 1, limit: REVIEW_PAGE_SIZE, sort: "recent", summary: { count: total } });
    expect(first.items).toHaveLength(Math.min(total, REVIEW_PAGE_SIZE));
    expect(first.summary.distribution.reduce((sum: number, d: { count: number }) => sum + d.count, 0)).toBe(total);

    const lowest = await (await list(product, "?sort=lowest")).json();
    const ratings = lowest.items.map((r: { rating: number }) => r.rating);
    expect([...ratings].sort((a, b) => a - b)).toEqual(ratings);

    const helpful = await (await list(product, "?sort=helpful")).json();
    const counts = helpful.items.map((r: { helpful: number }) => r.helpful);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("serves later pages without repeating reviews", async () => {
    const created = await Promise.all(
      Array.from({ length: REVIEW_PAGE_SIZE + 2 }, (_, i) =>
        testDb.user.create({ data: { email: `lector-${i}-${Date.now()}@resenas.test` } }).then((user) =>
          createReview(testDb, user.id, PRODUCT, content)
        )
      )
    );
    expect(created.every((r) => r.ok)).toBe(true);
    const one = await (await list(PRODUCT)).json();
    const two = await (await list(PRODUCT, "?page=2")).json();
    expect(one.hasMore).toBe(true);
    expect(two).toMatchObject({ page: 2, hasMore: false });
    const ids = [...one.items, ...two.items].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(REVIEW_PAGE_SIZE + 2);
  });

  it("falls back to the defaults for junk and 404s an unknown product", async () => {
    expect(await (await list("1", "?sort=%00&page=-4")).json()).toMatchObject({ sort: "recent", page: 1 });
    expect((await list("nope")).status).toBe(404);
  });
});

describe("GET /api/products/<id>/reviews/mine", () => {
  it("returns the user's review and votes; 401 without a session", async () => {
    expect((await mine(PRODUCT)).status).toBe(401);
    const theirs = await createReview(testDb, bruno.id, PRODUCT, content);
    const own = await createReview(testDb, ana.id, PRODUCT, { ...content, title: "La mía" });
    if (!theirs.ok || !own.ok) throw new Error("not created");
    await setHelpful(testDb, ana.id, theirs.reviewId, true);

    signInAs(ana);
    const body = await (await mine(PRODUCT)).json();
    expect(body).toMatchObject({ review: { id: own.reviewId, title: "La mía", userName: "Ana Pérez" }, helpful: [theirs.reviewId] });
  });
});
