import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListActionResult, ServerLists } from "@/lib/lists/types";
import type { CartItem, ProductSummary } from "@/types";

/*
 * <ListsSync />'s login merge: one at a time, idempotent (the same payload
 * and token until the answer is adopted), and changes made while it was out
 * replayed on top of the merged lists. The Server Actions are fakes; the
 * merge itself is covered against the database (integration/lists.test.ts).
 */

vi.mock("@/lib/lists/actions", () => ({
  addToCartAction: vi.fn(),
  setCartQuantityAction: vi.fn(),
  removeFromCartAction: vi.fn(),
  clearCartAction: vi.fn(),
  addToWishlistAction: vi.fn(),
  removeFromWishlistAction: vi.fn(),
  clearWishlistAction: vi.fn(),
  mergeListsAction: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ fetchProductsByIds: vi.fn(async () => []) }));
vi.mock("@/components/ui", () => ({ showToast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
const viewer = vi.hoisted(() => ({ current: null as { id: string; name: string } | null }));
vi.mock("@/providers/ViewerProvider", () => ({ useViewer: () => viewer.current }));

const actions = await import("@/lib/lists/actions");
const { ListsSync } = await import("@/components/layout/ListsSync");
const { useCartStore, useWishlistStore } = await import("@/stores");

const rex: ProductSummary = { id: "1", name: "Captain Rex Helmet", price: 899, img: "/rex.png", stock: 10 };
const leia: ProductSummary = { id: "2", name: "Princess Leia Helmet", price: 649, img: "/leia.png", stock: 10 };
const line = (product: ProductSummary, quantity: number): CartItem => ({
  id: product.id,
  name: product.name,
  price: product.price,
  image: product.img,
  stock: product.stock,
  quantity,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => act(async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
});

const becomeVisible = () =>
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

let serverLists: ServerLists;

beforeEach(async () => {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  for (const action of Object.values(actions)) vi.mocked(action).mockReset();
  serverLists = { cart: [], wishlist: [] };
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(serverLists), { status: 200 })) as typeof fetch;
  // A visitor's lists, loaded from localStorage.
  useCartStore.setState({ cart: [line(rex, 2)], owner: null });
  useWishlistStore.setState({ wishlist: [], owner: null });
  await useCartStore.persist.rehydrate();
  await useWishlistStore.persist.rehydrate();
  viewer.current = { id: "u1", name: "Ana" };
});

afterEach(() => {
  viewer.current = null;
});

describe("<ListsSync /> login merge", () => {
  it("merges once: a sync asked for meanwhile waits and then reloads instead of merging again", async () => {
    const answer = deferred<ListActionResult<ServerLists>>();
    vi.mocked(actions.mergeListsAction).mockReturnValue(answer.promise);
    render(<ListsSync />);
    await flush();
    expect(actions.mergeListsAction).toHaveBeenCalledTimes(1);

    // The tab comes back into view while the merge is out (twice).
    becomeVisible();
    becomeVisible();
    await flush();
    expect(actions.mergeListsAction).toHaveBeenCalledTimes(1);

    serverLists = { cart: [line(rex, 2)], wishlist: [] };
    answer.resolve({ ok: true, data: serverLists });
    await flush();
    expect(actions.mergeListsAction).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/lists", expect.anything());
    expect(useCartStore.getState()).toMatchObject({ owner: "u1", cart: [{ id: "1", quantity: 2 }] });
    expect(localStorage.getItem("lego-lists-merge")).toBeNull();
  });

  it("resends the same payload and token when the answer never came", async () => {
    vi.mocked(actions.mergeListsAction).mockRejectedValueOnce(new Error("network"));
    render(<ListsSync />);
    await flush();
    // Meanwhile (still a visitor's cart locally) one more unit is added.
    act(() => useCartStore.getState().increaseQuantity("1"));

    vi.mocked(actions.mergeListsAction).mockResolvedValue({ ok: true, data: { cart: [line(rex, 2)], wishlist: [] } });
    vi.mocked(actions.setCartQuantityAction).mockResolvedValue({ ok: true, data: line(rex, 3) });
    becomeVisible();
    await flush();

    const [first, second] = vi.mocked(actions.mergeListsAction).mock.calls.map(([input]) => input);
    expect(second).toEqual(first);
    expect(first).toMatchObject({ cart: [{ productId: "1", quantity: 2 }] });
    // The unit added meanwhile is replayed on top of the merged line, not merged twice.
    expect(actions.setCartQuantityAction).toHaveBeenCalledWith("1", 3);
    expect(useCartStore.getState()).toMatchObject({ owner: "u1", cart: [{ id: "1", quantity: 3 }] });
  });

  it("replays changes made while the merge was out instead of dropping them", async () => {
    const answer = deferred<ListActionResult<ServerLists>>();
    vi.mocked(actions.mergeListsAction).mockReturnValue(answer.promise);
    vi.mocked(actions.setCartQuantityAction).mockImplementation(async (id, quantity) => ({
      ok: true,
      data: line(id === "1" ? rex : leia, quantity as number),
    }));
    vi.mocked(actions.addToWishlistAction).mockResolvedValue({
      ok: true,
      data: { id: leia.id, name: leia.name, price: leia.price, image: leia.img, stock: leia.stock },
    });
    render(<ListsSync />);
    await flush();

    act(() => {
      useCartStore.getState().addItem(leia, 1);
      useWishlistStore.getState().addToWishlist(leia);
    });
    // The account already had 3 units of Rex: merged, 5.
    answer.resolve({ ok: true, data: { cart: [line(rex, 5)], wishlist: [] } });
    await flush();

    expect(actions.setCartQuantityAction).toHaveBeenCalledWith("2", 1);
    expect(actions.setCartQuantityAction).not.toHaveBeenCalledWith("1", expect.anything());
    expect(actions.addToWishlistAction).toHaveBeenCalledWith("2");
    expect(useCartStore.getState().cart.map((item) => [item.id, item.quantity])).toEqual([
      ["1", 5],
      ["2", 1],
    ]);
    expect(useWishlistStore.getState()).toMatchObject({ owner: "u1", wishlist: [{ id: "2" }] });
  });
});
