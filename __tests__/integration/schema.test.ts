import { beforeEach, describe, expect, it } from "vitest";
import { testDb, resetAndSeed } from "./setup/db";

/*
 * The database enforces the model's invariants on its own (check constraints
 * written in the first migration, unique keys), whatever code writes to it.
 */

beforeEach(async () => {
  await resetAndSeed();
});

const user = () => testDb.user.findFirstOrThrow({ where: { email: "carlos.m@example.com" } });
/** A Postgres check-constraint violation (SQLSTATE 23514), as Prisma reports it. */
const violation = expect.objectContaining({ message: expect.stringContaining("violates check constraint") });

describe("database constraints", () => {
  it("rejects negative stock and non-positive prices", async () => {
    await expect(testDb.product.update({ where: { id: "1" }, data: { stock: -1 } })).rejects.toEqual(violation);
    await expect(testDb.product.update({ where: { id: "1" }, data: { price: 0 } })).rejects.toEqual(violation);
    await expect(testDb.product.update({ where: { id: "1" }, data: { stock: 0 } })).resolves.toMatchObject({ stock: 0 });
  });

  it("keeps sale prices consistent", async () => {
    // On sale without an original price, or an original price below the price.
    await expect(testDb.product.update({ where: { id: "1" }, data: { originalPrice: null } })).rejects.toEqual(violation);
    await expect(testDb.product.update({ where: { id: "1" }, data: { originalPrice: 100 } })).rejects.toEqual(violation);
  });

  it("rejects ratings outside 1..5 and a second review by the same user", async () => {
    const { id: userId } = await user();
    await expect(
      testDb.review.create({ data: { userId, productId: "2", rating: 6, title: "t", comment: "c" } })
    ).rejects.toEqual(violation);
    await expect(
      testDb.review.create({ data: { userId, productId: "2", rating: 0, title: "t", comment: "c" } })
    ).rejects.toEqual(violation);
    // Carlos already reviewed product 1 in the seed.
    await expect(
      testDb.review.create({ data: { userId, productId: "1", rating: 4, title: "t", comment: "c" } })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("requires positive cart quantities, one line per product", async () => {
    const { id: userId } = await user();
    await expect(testDb.cartItem.create({ data: { userId, productId: "1", quantity: 0 } })).rejects.toEqual(violation);
    await testDb.cartItem.create({ data: { userId, productId: "1", quantity: 2 } });
    await expect(testDb.cartItem.create({ data: { userId, productId: "1", quantity: 1 } })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("allows one wishlist entry and one helpful vote per user", async () => {
    const { id: userId } = await user();
    await testDb.wishlistItem.create({ data: { userId, productId: "5" } });
    await expect(testDb.wishlistItem.create({ data: { userId, productId: "5" } })).rejects.toMatchObject({ code: "P2002" });

    const review = await testDb.review.findFirstOrThrow({ where: { userId: { not: userId } } });
    await testDb.reviewHelpful.deleteMany({ where: { userId, reviewId: review.id } });
    await testDb.reviewHelpful.create({ data: { userId, reviewId: review.id } });
    await expect(testDb.reviewHelpful.create({ data: { userId, reviewId: review.id } })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("checks order totals and line quantities", async () => {
    const base = {
      email: "guest@example.com",
      firstName: "Ana",
      lastName: "L",
      phone: "1",
      address: "a",
      city: "c",
      state: "s",
      zipCode: "1000",
      country: "Argentina",
      subtotal: 1000,
      shipping: 299,
    };
    await expect(testDb.order.create({ data: { ...base, total: 1000 } })).rejects.toEqual(violation);
    const order = await testDb.order.create({ data: { ...base, total: 1299 } });
    expect(order).toMatchObject({ status: "PENDING", userId: null, currency: "ars" });
    await expect(
      testDb.orderItem.create({
        data: { orderId: order.id, productId: "1", name: "x", unitPrice: 1000, image: "/x.png", quantity: 0 },
      })
    ).rejects.toEqual(violation);
  });

  it("stores emails lowercased", async () => {
    await expect(testDb.user.create({ data: { email: "Mixed@Example.com" } })).rejects.toEqual(violation);
  });

  it("records each Stripe event once", async () => {
    await testDb.processedStripeEvent.create({ data: { id: "evt_1", type: "payment_intent.succeeded" } });
    await expect(
      testDb.processedStripeEvent.create({ data: { id: "evt_1", type: "payment_intent.succeeded" } })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps order lines readable after their product is deleted", async () => {
    const item = await testDb.orderItem.findFirstOrThrow({ where: { productId: "1" } });
    await testDb.product.delete({ where: { id: "1" } });
    const after = await testDb.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after).toMatchObject({ productId: null, name: item.name, unitPrice: item.unitPrice });
    // The product's reviews and list entries go with it.
    expect(await testDb.review.count({ where: { productId: "1" } })).toBe(0);
  });
});
