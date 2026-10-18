import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, getCart, mergeCart, setCartQuantity } from "@/lib/lists/cart";
import { mergeLists } from "@/lib/lists/merge";
import { addToWishlist, getWishlist, mergeWishlist } from "@/lib/lists/wishlist";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * Server carts and wishlists against the test database: the merge on login,
 * stock caps, fresh product data, and that the Server Actions and the Route
 * Handler only ever touch the signed-in user's rows. Auth.js's auth() is
 * stubbed with the session under test; getCurrentUser() still checks it
 * against the database.
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});

const actions = await import("@/lib/lists/actions");
const { GET: getLists } = await import("@/app/api/lists/route");

let ana: { id: string };
let bruno: { id: string };

const signInAs = (user: { id: string } | null) => {
  session.current = user ? { user: { id: user.id, role: "USER" }, sessionVersion: 0 } : null;
};

const setStock = (id: string, stock: number) => testDb.product.update({ where: { id }, data: { stock } });

let tokens = 0;
/** A fresh merge token (what a browser generates for each guest lists it merges). */
const token = () => `token-de-prueba-${String(++tokens).padStart(4, "0")}`;

const quantities = async (userId: string) =>
  Object.fromEntries((await testDb.cartItem.findMany({ where: { userId } })).map((row) => [row.productId, row.quantity]));

beforeAll(async () => {
  await resetAndSeed();
  ana = await testDb.user.create({ data: { email: "ana@listas.test", name: "Ana" } });
  bruno = await testDb.user.create({ data: { email: "bruno@listas.test", name: "Bruno" } });
});

beforeEach(async () => {
  signInAs(null);
  await testDb.cartItem.deleteMany();
  await testDb.wishlistItem.deleteMany();
  await Promise.all([setStock("1", 10), setStock("2", 10), setStock("3", 20), setStock("4", 20)]);
});

describe("mergeCart (login)", () => {
  it("adds the guest quantities to the saved ones, capped by the current stock", async () => {
    await setStock("1", 5);
    await testDb.cartItem.createMany({
      data: [
        { userId: ana.id, productId: "1", quantity: 3 },
        { userId: ana.id, productId: "2", quantity: 1 },
      ],
    });

    const cart = await mergeCart(testDb, ana.id, [
      { productId: "1", quantity: 4 },
      { productId: "3", quantity: 2 },
    ]);

    expect(await quantities(ana.id)).toEqual({ "1": 5, "2": 1, "3": 2 });
    // Saved lines first, then the guest's new ones in their order.
    expect(cart.map((line) => [line.id, line.quantity])).toEqual([
      ["1", 5],
      ["2", 1],
      ["3", 2],
    ]);
  });

  it("skips unknown and sold-out products and adds up repeated ones", async () => {
    await setStock("4", 0);
    const cart = await mergeCart(testDb, ana.id, [
      { productId: "nope", quantity: 1 },
      { productId: "4", quantity: 1 },
      { productId: "2", quantity: 2 },
      { productId: "2", quantity: 3 },
    ]);
    expect(cart.map((line) => [line.id, line.quantity])).toEqual([["2", 5]]);
  });

  it("returns the product's current name, price, picture and stock, never a snapshot", async () => {
    await testDb.product.update({ where: { id: "2" }, data: { price: 1234 } });
    const [line] = await mergeCart(testDb, ana.id, [{ productId: "2", quantity: 1 }]);
    const product = await testDb.product.findUniqueOrThrow({ where: { id: "2" } });
    expect(line).toEqual({ id: "2", name: product.name, price: 1234, image: product.img, stock: 10, quantity: 1 });
  });

  it("is a no-op merge for an empty guest cart (returns the saved cart)", async () => {
    await testDb.cartItem.create({ data: { userId: ana.id, productId: "3", quantity: 2 } });
    expect((await mergeCart(testDb, ana.id, [])).map((line) => line.id)).toEqual(["3"]);
  });
});

describe("cart writes and reads", () => {
  it("caps an add at the stock, summing with the line", async () => {
    await setStock("1", 4);
    await addToCart(testDb, ana.id, "1", 3);
    const result = await addToCart(testDb, ana.id, "1", 3);
    expect(result).toMatchObject({ ok: true, line: { id: "1", quantity: 4, stock: 4 } });
  });

  it("counts concurrent adds from two tabs", async () => {
    await Promise.all([addToCart(testDb, ana.id, "3", 2), addToCart(testDb, ana.id, "3", 3)]);
    expect(await quantities(ana.id)).toEqual({ "3": 5 });
  });

  it("refuses sold-out and unknown products", async () => {
    await setStock("1", 0);
    expect(await addToCart(testDb, ana.id, "1", 1)).toEqual({ ok: false, reason: "out_of_stock" });
    expect(await setCartQuantity(testDb, ana.id, "nope", 1)).toEqual({ ok: false, reason: "not_found" });
    expect(await quantities(ana.id)).toEqual({});
  });

  it("sets an exact quantity, capped by the stock", async () => {
    await setStock("2", 3);
    expect(await setCartQuantity(testDb, ana.id, "2", 9)).toMatchObject({ ok: true, line: { quantity: 3 } });
    expect(await setCartQuantity(testDb, ana.id, "2", 1)).toMatchObject({ ok: true, line: { quantity: 1 } });
  });

  it("lists lines capped by stock that dropped after they were saved, and hides sold-out ones", async () => {
    await testDb.cartItem.createMany({
      data: [
        { userId: ana.id, productId: "1", quantity: 6 },
        { userId: ana.id, productId: "2", quantity: 1 },
      ],
    });
    await setStock("1", 2);
    await setStock("2", 0);
    expect((await getCart(testDb, ana.id)).map((line) => [line.id, line.quantity, line.stock])).toEqual([["1", 2, 2]]);
    // The sold-out line stays stored: it comes back when restocked.
    await setStock("2", 5);
    expect((await getCart(testDb, ana.id)).map((line) => line.id)).toEqual(["1", "2"]);
  });
});

describe("wishlist", () => {
  it("merges as a union, skipping unknown products, keeping the guest order after the saved items", async () => {
    await testDb.wishlistItem.create({ data: { userId: ana.id, productId: "2" } });
    const list = await mergeWishlist(testDb, ana.id, ["4", "2", "nope", "1"]);
    expect(list.map((item) => item.id)).toEqual(["2", "4", "1"]);
  });

  it("saving twice keeps one item; unknown products are refused", async () => {
    await addToWishlist(testDb, ana.id, "3");
    await addToWishlist(testDb, ana.id, "3");
    expect((await getWishlist(testDb, ana.id)).map((item) => item.id)).toEqual(["3"]);
    expect(await addToWishlist(testDb, ana.id, "nope")).toBeNull();
  });

  it("lists sold-out products with their current stock", async () => {
    await addToWishlist(testDb, ana.id, "1");
    await setStock("1", 0);
    expect(await getWishlist(testDb, ana.id)).toMatchObject([{ id: "1", stock: 0 }]);
  });
});

describe("mergeLists (idempotent per token)", () => {
  const guest = { cart: [{ productId: "1", quantity: 2 }], wishlist: ["3"] };

  it("adds a guest cart once, however many times the same merge is sent", async () => {
    await testDb.cartItem.create({ data: { userId: ana.id, productId: "1", quantity: 1 } });
    const merge = { token: token(), ...guest };
    expect(await mergeLists(testDb, ana.id, merge)).toMatchObject({ merged: true, lists: { cart: [{ id: "1", quantity: 3 }] } });
    // A retry (the answer was lost) or a second sync started meanwhile: nothing is added again.
    expect(await mergeLists(testDb, ana.id, merge)).toMatchObject({ merged: false, lists: { cart: [{ id: "1", quantity: 3 }] } });
    expect(await quantities(ana.id)).toEqual({ "1": 3 });
    // A new guest cart (a new token) is merged as usual.
    await mergeLists(testDb, ana.id, { token: token(), ...guest });
    expect(await quantities(ana.id)).toEqual({ "1": 5 });
  });

  it("adds it once when the same merge arrives twice at the same time", async () => {
    const merge = { token: token(), ...guest };
    const results = await Promise.all([mergeLists(testDb, ana.id, merge), mergeLists(testDb, ana.id, merge)]);
    expect(results.map((result) => result.merged).sort()).toEqual([false, true]);
    expect(await quantities(ana.id)).toEqual({ "1": 2 });
  });

  it("keeps tokens per account: the same token still merges into another account", async () => {
    const merge = { token: token(), ...guest };
    await mergeLists(testDb, ana.id, merge);
    expect(await mergeLists(testDb, bruno.id, merge)).toMatchObject({ merged: true });
    expect(await quantities(bruno.id)).toEqual({ "1": 2 });
    expect(await quantities(ana.id)).toEqual({ "1": 2 });
  });

  it("through the Server Action too", async () => {
    signInAs(ana);
    const merge = { token: token(), ...guest };
    await actions.mergeListsAction(merge);
    expect(await actions.mergeListsAction(merge)).toMatchObject({ ok: true, data: { cart: [{ id: "1", quantity: 2 }] } });
    expect(await quantities(ana.id)).toEqual({ "1": 2 });
  });
});

describe("Server Actions and GET /api/lists (authorisation)", () => {
  it("refuses every action without a session and writes nothing", async () => {
    expect(await actions.addToCartAction("1", 1)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await actions.addToWishlistAction("1")).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await actions.mergeListsAction({ token: token(), cart: [], wishlist: [] })).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await testDb.cartItem.count()).toBe(0);
    expect((await getLists()).status).toBe(401);
  });

  it("validates the input with zod (no client prices, no absurd quantities)", async () => {
    signInAs(ana);
    expect(await actions.addToCartAction("1", 0)).toMatchObject({ ok: false, code: "invalid" });
    expect(await actions.setCartQuantityAction("1", 1.5)).toMatchObject({ ok: false, code: "invalid" });
    expect(await actions.setCartQuantityAction("", 1)).toMatchObject({ ok: false, code: "invalid" });
    expect(await actions.mergeListsAction({ token: token(), cart: [{ productId: "1", quantity: 1 }] })).toMatchObject({
      ok: false,
      code: "invalid",
    });
    // The merge token is required and has a fixed shape.
    expect(await actions.mergeListsAction({ cart: [{ productId: "1", quantity: 1 }], wishlist: [] })).toMatchObject({ code: "invalid" });
    expect(await actions.mergeListsAction({ token: "x", cart: [{ productId: "1", quantity: 1 }], wishlist: [] })).toMatchObject({
      code: "invalid",
    });
    expect(await testDb.cartItem.count()).toBe(0);

    // Anything else the client sends (a price) is ignored: the line carries the database's.
    const merged = await actions.mergeListsAction({ token: token(), cart: [{ productId: "1", quantity: 1, price: 1 }], wishlist: [] });
    const product = await testDb.product.findUniqueOrThrow({ where: { id: "1" } });
    expect(merged).toMatchObject({ ok: true, data: { cart: [{ id: "1", price: product.price }] } });
  });

  it("only touches the signed-in user's cart and wishlist", async () => {
    await testDb.cartItem.create({ data: { userId: bruno.id, productId: "1", quantity: 2 } });
    await testDb.wishlistItem.create({ data: { userId: bruno.id, productId: "1" } });

    signInAs(ana);
    await actions.addToCartAction("1", 1);
    await actions.removeFromCartAction("1");
    await actions.clearCartAction();
    await actions.removeFromWishlistAction("1");
    await actions.clearWishlistAction();
    await actions.mergeListsAction({ token: token(), cart: [{ productId: "2", quantity: 1 }], wishlist: ["2"] });

    expect(await quantities(bruno.id)).toEqual({ "1": 2 });
    expect(await testDb.wishlistItem.count({ where: { userId: bruno.id } })).toBe(1);
    expect(await quantities(ana.id)).toEqual({ "2": 1 });

    const body = await (await getLists()).json();
    expect(body.cart.map((line: { id: string }) => line.id)).toEqual(["2"]);
    expect(body.wishlist.map((item: { id: string }) => item.id)).toEqual(["2"]);
  });

  it("answers with the server's line: capped quantity, current price", async () => {
    signInAs(ana);
    await setStock("1", 2);
    expect(await actions.addToCartAction("1", 5)).toMatchObject({ ok: true, data: { id: "1", quantity: 2, stock: 2 } });
    await setStock("1", 0);
    expect(await actions.setCartQuantityAction("1", 1)).toMatchObject({ ok: false, code: "out_of_stock" });
  });

  it("does not count a session whose user was deleted", async () => {
    const ghost = await testDb.user.create({ data: { email: "ghost@listas.test" } });
    signInAs(ghost);
    await testDb.user.delete({ where: { id: ghost.id } });
    expect(await actions.addToCartAction("1", 1)).toMatchObject({ ok: false, code: "unauthenticated" });
  });
});
