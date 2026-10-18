import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { setListsRemote, type ListsRemote } from "@/stores/listsRemote";
import { planListsSync } from "@/lib/lists/sync-plan";
import type { ListActionResult } from "@/lib/lists/types";
import type { CartItem, ProductSummary, WishlistItem } from "@/types";

/*
 * The stores' server side for signed-in users: optimistic changes, the
 * server's answer adopted, rollback on failure, stale answers ignored. The
 * remote is a fake here; the Server Actions behind it are covered against the
 * database (__tests__/integration/lists.test.ts).
 */

const rex: ProductSummary = { id: "1", name: "Captain Rex Helmet", price: 899, img: "/rex.png", stock: 5 };
const leia: ProductSummary = { id: "2", name: "Princess Leia Helmet", price: 649, img: "/leia.png", stock: 10 };

const line = (product: ProductSummary, quantity: number, overrides: Partial<CartItem> = {}): CartItem => ({
  id: product.id,
  name: product.name,
  price: product.price,
  image: product.img,
  stock: product.stock,
  quantity,
  ...overrides,
});

/** A promise the test resolves by hand, to control the order answers arrive in. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ok = <T>(data: T): ListActionResult<T> => ({ ok: true, data });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let remote: { [K in keyof ListsRemote]: ReturnType<typeof vi.fn> };
let uninstall: () => void;

beforeEach(() => {
  remote = {
    addToCart: vi.fn(),
    setCartQuantity: vi.fn(),
    removeFromCart: vi.fn().mockResolvedValue(ok(null)),
    clearCart: vi.fn().mockResolvedValue(ok(null)),
    addToWishlist: vi.fn(),
    removeFromWishlist: vi.fn().mockResolvedValue(ok(null)),
    clearWishlist: vi.fn().mockResolvedValue(ok(null)),
    onError: vi.fn(),
  };
  uninstall = setListsRemote(remote as unknown as ListsRemote);
  useCartStore.setState({ cart: [], owner: "u1" });
  useWishlistStore.setState({ wishlist: [], owner: "u1" });
});

afterEach(() => {
  uninstall();
  useCartStore.setState({ cart: [], owner: null });
  useWishlistStore.setState({ wishlist: [], owner: null });
});

describe("cart of a signed-in user", () => {
  it("shows the change at once, then adopts the server's line (capped quantity, current price)", async () => {
    const answer = deferred<ListActionResult<CartItem>>();
    remote.addToCart.mockReturnValue(answer.promise);
    useCartStore.getState().addItem(rex, 2);
    expect(useCartStore.getState().cart).toEqual([line(rex, 2)]);
    expect(remote.addToCart).toHaveBeenCalledWith("1", 2);

    answer.resolve(ok(line(rex, 1, { price: 799, stock: 1 })));
    await flush();
    expect(useCartStore.getState().cart).toEqual([line(rex, 1, { price: 799, stock: 1 })]);
  });

  it("rolls the line back and reports the error when the server refuses", async () => {
    useCartStore.setState({ cart: [line(leia, 1)] });
    remote.addToCart.mockResolvedValue({ ok: false, code: "out_of_stock", error: "Ese producto está agotado." });
    useCartStore.getState().addItem(rex, 1);
    await flush();
    expect(useCartStore.getState().cart).toEqual([line(leia, 1)]);
    expect(remote.onError).toHaveBeenCalledWith("Ese producto está agotado.", "out_of_stock");
  });

  it("puts a removed line back in its place when the request fails", async () => {
    useCartStore.setState({ cart: [line(rex, 1), line(leia, 2)] });
    remote.removeFromCart.mockRejectedValue(new Error("offline"));
    useCartStore.getState().removeItem("1");
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["2"]);
    await flush();
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["1", "2"]);
    expect(remote.onError).toHaveBeenCalledWith(expect.stringMatching(/conexión/), "network");
  });

  it("sends exact quantities and ignores an older answer that arrives after a newer change", async () => {
    useCartStore.setState({ cart: [line(leia, 1)] });
    const first = deferred<ListActionResult<CartItem>>();
    const second = deferred<ListActionResult<CartItem>>();
    remote.setCartQuantity.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    useCartStore.getState().increaseQuantity("2");
    useCartStore.getState().increaseQuantity("2");
    expect(remote.setCartQuantity.mock.calls).toEqual([
      ["2", 2],
      ["2", 3],
    ]);

    first.resolve(ok(line(leia, 2)));
    await flush();
    expect(useCartStore.getState().cart[0]!.quantity).toBe(3);
    second.resolve(ok(line(leia, 3)));
    await flush();
    expect(useCartStore.getState().cart[0]!.quantity).toBe(3);
  });

  it("clears on the server too, and restores the cleared lines if that fails", async () => {
    useCartStore.setState({ cart: [line(rex, 1), line(leia, 1)] });
    remote.clearCart.mockResolvedValue({ ok: false, code: "unauthenticated", error: "Tu sesión terminó." });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().cart).toEqual([]);
    await flush();
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["1", "2"]);
  });

  it("an undo puts the exact quantity back on the server", () => {
    remote.setCartQuantity.mockResolvedValue(ok(line(rex, 3)));
    useCartStore.getState().restoreItem(line(rex, 3), { index: 0 });
    expect(remote.setCartQuantity).toHaveBeenCalledWith("1", 3);
  });

  it("never calls the server for a visitor's cart", () => {
    useCartStore.setState({ owner: null });
    useCartStore.getState().addItem(rex, 1);
    useCartStore.getState().setQuantity("1", 2);
    useCartStore.getState().removeItem("1");
    expect(remote.addToCart).not.toHaveBeenCalled();
    expect(remote.setCartQuantity).not.toHaveBeenCalled();
    expect(remote.removeFromCart).not.toHaveBeenCalled();
  });
});

describe("wishlist of a signed-in user", () => {
  it("saves on the server and adopts its item; rolls back when refused", async () => {
    const saved: WishlistItem = { id: "1", name: rex.name, price: 799, image: rex.img, stock: 5 };
    remote.addToWishlist.mockResolvedValueOnce(ok(saved));
    expect(useWishlistStore.getState().toggleWishlist(rex)).toBe(true);
    await flush();
    expect(useWishlistStore.getState().wishlist).toEqual([saved]);

    remote.addToWishlist.mockResolvedValueOnce({ ok: false, code: "not_found", error: "Ese producto ya no está en el catálogo." });
    useWishlistStore.getState().addToWishlist(leia);
    await flush();
    expect(useWishlistStore.getState().wishlist.map((item) => item.id)).toEqual(["1"]);
    expect(remote.onError).toHaveBeenCalledWith("Ese producto ya no está en el catálogo.", "not_found");
  });

  it("removes on the server and restores the item in place if that fails", async () => {
    const items = [rex, leia].map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.img, stock: p.stock }));
    useWishlistStore.setState({ wishlist: items });
    remote.removeFromWishlist.mockResolvedValue({ ok: false, code: "invalid", error: "No pudimos guardar el cambio." });
    useWishlistStore.getState().removeFromWishlist("1");
    await flush();
    expect(useWishlistStore.getState().wishlist.map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("refreshLines (a visitor's cart)", () => {
  it("adopts current prices and stock, caps quantities and drops gone or sold-out products", () => {
    const other = { ...leia, id: "3" };
    useCartStore.setState({ owner: null, cart: [line(rex, 4), line(leia, 2), line(other, 1)] });
    useCartStore.getState().refreshLines([{ ...rex, price: 950, stock: 2 }, { ...leia, stock: 0 }], ["1", "2", "3"]);
    expect(useCartStore.getState().cart).toEqual([line(rex, 2, { price: 950, stock: 2 })]);
  });

  it("leaves lines it did not ask about alone", () => {
    useCartStore.setState({ owner: null, cart: [line(rex, 1), line(leia, 1)] });
    useCartStore.getState().refreshLines([], ["1"]);
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["2"]);
  });
});

describe("planListsSync", () => {
  it("signed out: clears an account's copy, keeps a visitor's own lists", () => {
    expect(planListsSync(null, { cart: null, wishlist: null })).toEqual({ kind: "visitor", clearCart: false, clearWishlist: false });
    expect(planListsSync(null, { cart: "u1", wishlist: "u1" })).toEqual({ kind: "visitor", clearCart: true, clearWishlist: true });
  });

  it("signed in: merges a visitor's lists once, reloads the account's own copy, never merges another account's", () => {
    expect(planListsSync("u1", { cart: null, wishlist: null })).toEqual({ kind: "account", mergeCart: true, mergeWishlist: true });
    expect(planListsSync("u1", { cart: "u1", wishlist: "u1" })).toEqual({ kind: "account", mergeCart: false, mergeWishlist: false });
    expect(planListsSync("u2", { cart: "u1", wishlist: null })).toEqual({ kind: "account", mergeCart: false, mergeWishlist: true });
  });
});

describe("persisted owner", () => {
  it("a stored cart from before accounts (no owner) loads as a visitor's", async () => {
    // (Every setState is persisted: set the state first, then the stored value.)
    useCartStore.setState({ cart: [], owner: "u9" });
    localStorage.setItem("lego-cart-storage", JSON.stringify({ state: { cart: [line(rex, 1)] }, version: 1 }));
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState()).toMatchObject({ cart: [line(rex, 1)], owner: null });
  });

  it("keeps the owner across reloads", async () => {
    useCartStore.getState().replaceCart([line(rex, 1)], "u1");
    const stored = localStorage.getItem("lego-cart-storage")!;
    useCartStore.setState({ cart: [], owner: null });
    localStorage.setItem("lego-cart-storage", stored);
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().owner).toBe("u1");
  });
});

describe("noWritesSince (full reloads never overwrite a newer change)", () => {
  it("is true only when no write was out at the start or sent since", async () => {
    const { writeGeneration, noWritesSince } = await import("@/stores/listsRemote");
    const idle = writeGeneration();
    expect(noWritesSince(idle)).toBe(true);

    const answer = deferred<ListActionResult<CartItem>>();
    remote.setCartQuantity.mockReturnValue(answer.promise);
    useCartStore.setState({ cart: [line(leia, 1)] });
    useCartStore.getState().setQuantity("2", 2);
    expect(noWritesSince(idle)).toBe(false);

    // Taken while that write is out: never counts as quiet.
    const busy = writeGeneration();
    answer.resolve(ok(line(leia, 2)));
    await flush();
    expect(noWritesSince(busy)).toBe(false);
    expect(noWritesSince(writeGeneration())).toBe(true);
  });
});
