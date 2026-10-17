import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartView } from "@/components/cart/CartView";
import { WishlistView } from "@/components/wishlist/WishlistView";
import { CompareView } from "@/components/compare/CompareView";
import { useCartStore, useCompareStore, useWishlistStore } from "@/stores";
import { formatPrice as format } from "@/lib/utils";
import { mockFetch, renderWithQuery } from "../helpers/render";
import type { Product } from "@/types";

const formatPrice = (value: number) => format(value).replace(/\s/g, " ");

const undo = vi.hoisted(() => ({
  last: undefined as undefined | { message: string; onUndo: () => void },
  info: undefined as undefined | string,
}));
vi.mock("@/components/ui/Toast", () => ({
  showToast: {
    undo: (message: string, onUndo: () => void) => {
      undo.last = { message, onUndo };
    },
    cart: () => {},
    info: (message: string) => {
      undo.info = message;
    },
    success: () => {},
    error: () => {},
    warning: () => {},
  },
  toast: { dismiss: () => {} },
  Toaster: () => null,
}));

const line = (id: string, price: number, quantity = 1, stock = 5) => ({
  id,
  name: `Set ${id}`,
  price,
  image: "/images/lego.png",
  quantity,
  stock,
});

const product = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  name: `Set ${id}`,
  price: 1000,
  isNew: false,
  isOnSale: false,
  rating: 4.5,
  reviewCount: 2,
  category: "helmet",
  type: "Set",
  age: "18+",
  theme: "Star Wars",
  interests: [],
  pieces: "501-1000",
  highlight: "",
  img: "/images/lego.png",
  images: [],
  stock: 5,
  shortDescription: "",
  description: "",
  ...overrides,
});

beforeAll(async () => {
  await Promise.all([
    useCartStore.persist.rehydrate(),
    useWishlistStore.persist.rehydrate(),
    useCompareStore.persist.rehydrate(),
  ]);
});

beforeEach(() => {
  undo.last = undefined;
  undo.info = undefined;
  useCartStore.setState({ cart: [] });
  useWishlistStore.setState({ wishlist: [] });
  useCompareStore.setState({ ids: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CartView", () => {
  it("shows the empty state with the recommended products", () => {
    renderWithQuery(<CartView recommended={[product("9", { name: "Recomendado" })]} />);
    expect(screen.getByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument();
    const recommended = screen.getByRole("region", { name: "Te puede interesar" });
    expect(within(recommended).getByText("Recomendado")).toBeInTheDocument();
  });

  it("sums the lines and charges shipping below the free threshold", () => {
    useCartStore.setState({ cart: [line("1", 1000, 2), line("2", 500)] });
    renderWithQuery(<CartView recommended={[]} />);

    expect(screen.getAllByTestId("cart-item")).toHaveLength(2);
    expect(screen.getByTestId("cart-subtotal")).toHaveTextContent(formatPrice(2500));
    expect(screen.getByTestId("cart-shipping")).toHaveTextContent(formatPrice(299));
    expect(screen.getByTestId("cart-total")).toHaveTextContent(formatPrice(2799));
    expect(screen.getByRole("link", { name: /Finalizar compra/ })).toHaveAttribute("href", "/checkout");
  });

  it("ships free from $5000", () => {
    useCartStore.setState({ cart: [line("1", 2500, 2)] });
    renderWithQuery(<CartView recommended={[]} />);
    expect(screen.getByTestId("cart-shipping")).toHaveTextContent("Gratis");
    expect(screen.getByTestId("cart-total")).toHaveTextContent(formatPrice(5000));
  });

  it("removes a line with an undo that puts it back in place", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ cart: [line("1", 1000, 2), line("2", 500)] });
    renderWithQuery(<CartView recommended={[]} />);

    await user.click(screen.getByRole("button", { name: "Eliminar Set 1 del carrito" }));
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["2"]);
    expect(undo.last?.message).toBe("Set 1 eliminado del carrito");

    act(() => undo.last!.onUndo());
    expect(useCartStore.getState().cart.map((l) => [l.id, l.quantity])).toEqual([
      ["1", 2],
      ["2", 1],
    ]);
  });

  it("keeps the order when two removals are undone in reverse", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ cart: [line("1", 1000), line("2", 500), line("3", 300)] });
    renderWithQuery(<CartView recommended={[]} />);

    await user.click(screen.getByRole("button", { name: "Eliminar Set 1 del carrito" }));
    const undoFirst = undo.last!.onUndo;
    await user.click(screen.getByRole("button", { name: "Eliminar Set 2 del carrito" }));
    const undoSecond = undo.last!.onUndo;
    act(() => undoFirst());
    act(() => undoSecond());
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["1", "2", "3"]);
  });

  it("changes quantities within the stock", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ cart: [line("1", 1000, 1, 2)] });
    renderWithQuery(<CartView recommended={[]} />);

    const stepper = screen.getByRole("group", { name: "Cantidad de Set 1" });
    await user.click(within(stepper).getByRole("button", { name: "Aumentar cantidad" }));
    expect(useCartStore.getState().cart[0].quantity).toBe(2);
    expect(screen.getByText("Máximo disponible: 2")).toBeInTheDocument();
  });

  it("empties the cart with undo", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ cart: [line("1", 1000), line("2", 500)] });
    renderWithQuery(<CartView recommended={[]} />);

    await user.click(screen.getByRole("button", { name: "Vaciar carrito" }));
    expect(useCartStore.getState().cart).toEqual([]);
    act(() => undo.last!.onUndo());
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual(["1", "2"]);
  });
});

describe("WishlistView", () => {
  it("moves a product to the cart and undo reverts both lists", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1", { theme: "Marvel" }), product("2")] }));
    useWishlistStore.setState({
      wishlist: [
        { id: "1", name: "Set 1", price: 1000, image: "/images/lego.png", stock: 5 },
        { id: "2", name: "Set 2", price: 1000, image: "/images/lego.png", stock: 5 },
      ],
    });
    renderWithQuery(<WishlistView recommended={[]} />);
    await screen.findByText("Marvel");

    const card = screen.getAllByTestId("wishlist-item")[0];
    await user.click(within(card).getByRole("button", { name: "Mover al carrito" }));
    expect(useCartStore.getState().cart.map((l) => [l.id, l.quantity])).toEqual([["1", 1]]);
    expect(useWishlistStore.getState().wishlist.map((i) => i.id)).toEqual(["2"]);
    expect(undo.last?.message).toBe("Set 1 movido al carrito");

    act(() => undo.last!.onUndo());
    expect(useCartStore.getState().cart).toEqual([]);
    expect(useWishlistStore.getState().wishlist.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("undoing 'Mover todo' keeps what was added to the cart afterwards", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1", { theme: "Marvel" }), product("2")] }));
    useCartStore.setState({ cart: [line("2", 1000, 2)] });
    useWishlistStore.setState({
      wishlist: [
        { id: "1", name: "Set 1", price: 1000, image: "/images/lego.png", stock: 5 },
        { id: "2", name: "Set 2", price: 1000, image: "/images/lego.png", stock: 5 },
      ],
    });
    renderWithQuery(<WishlistView recommended={[]} />);
    await screen.findByText("Marvel");

    await user.click(screen.getByRole("button", { name: "Mover todo al carrito" }));
    expect(undo.last?.message).toBe("2 productos movidos al carrito");
    expect(useCartStore.getState().cart.map((l) => [l.id, l.quantity])).toEqual([
      ["2", 3],
      ["1", 1],
    ]);

    act(() => useCartStore.getState().addItem({ id: "9", name: "Set 9", price: 10, img: "/x.png", stock: 3 }));
    act(() => undo.last!.onUndo());
    expect(useCartStore.getState().cart.map((l) => [l.id, l.quantity])).toEqual([
      ["2", 2],
      ["9", 1],
    ]);
    expect(useWishlistStore.getState().wishlist.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("does not move a set the cart already holds at the stock limit", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1", { stock: 3, theme: "Marvel" }), product("2"), product("3")] }));
    useCartStore.setState({ cart: [line("1", 1000, 3, 3)] });
    const saved = ["1", "2", "3"].map((id) => ({ id, name: `Set ${id}`, price: 1000, image: "/images/lego.png", stock: 5 }));
    useWishlistStore.setState({ wishlist: saved });
    renderWithQuery(<WishlistView recommended={[]} />);
    await screen.findByText("Marvel");

    const card = screen.getAllByTestId("wishlist-item")[0];
    expect(within(card).getByTestId("move-to-cart-btn")).toBeDisabled();
    expect(within(card).getByTestId("move-to-cart-btn")).toHaveTextContent("Máximo en el carrito");
    expect(within(card).getByTestId("saved-in-cart")).toHaveTextContent("Ya tienes el máximo disponible en el carrito");

    await user.click(screen.getByRole("button", { name: "Mover todo al carrito" }));
    expect(undo.last?.message).toBe("2 productos movidos al carrito");
    expect(useWishlistStore.getState().wishlist.map((i) => i.id)).toEqual(["1"]);
    expect(useCartStore.getState().cart.find((l) => l.id === "1")?.quantity).toBe(3);
  });

  it("undoing 'Vaciar favoritos' keeps items saved afterwards", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1")] }));
    useWishlistStore.setState({ wishlist: [{ id: "1", name: "Set 1", price: 1000, image: "/images/lego.png", stock: 5 }] });
    renderWithQuery(<WishlistView recommended={[]} />);

    await user.click(screen.getByRole("button", { name: "Vaciar favoritos" }));
    act(() => useWishlistStore.getState().addToWishlist({ id: "7", name: "Set 7", price: 1, img: "/x.png", stock: 1 }));
    act(() => undo.last!.onUndo());
    expect(useWishlistStore.getState().wishlist.map((i) => i.id)).toEqual(["1", "7"]);
  });

  it("disables moving a sold-out product", async () => {
    mockFetch(() => ({ items: [product("1", { stock: 0 })] }));
    useWishlistStore.setState({ wishlist: [{ id: "1", name: "Set 1", price: 1000, image: "/images/lego.png", stock: 5 }] });
    renderWithQuery(<WishlistView recommended={[]} />);
    await waitFor(() => expect(screen.getByTestId("move-to-cart-btn")).toBeDisabled());
    expect(screen.getByTestId("move-to-cart-btn")).toHaveTextContent("Agotado");
  });

  it("removes with undo and shows the empty state when nothing is left", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1")] }));
    useWishlistStore.setState({ wishlist: [{ id: "1", name: "Set 1", price: 1000, image: "/images/lego.png", stock: 5 }] });
    renderWithQuery(<WishlistView recommended={[]} />);

    await user.click(screen.getByRole("button", { name: "Quitar Set 1 de favoritos" }));
    expect(await screen.findByRole("heading", { name: "Todavía no tienes favoritos" })).toBeInTheDocument();
    act(() => undo.last!.onUndo());
    expect(useWishlistStore.getState().wishlist).toHaveLength(1);
  });
});

describe("CompareView", () => {
  it("highlights only the rows whose values differ", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1"), product("2", { price: 649, theme: "Marvel" })] }));
    useCompareStore.setState({ ids: ["1", "2"] });
    renderWithQuery(<CompareView />);

    const table = await screen.findByRole("table");
    expect(within(table).getAllByTestId("compare-column")).toHaveLength(2);
    expect(within(table).queryByText("(valores distintos)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Resaltar diferencias" }));
    expect(within(table).getByRole("rowheader", { name: /^Precio\s*\(valores distintos\)$/ })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: /^Tema\s*\(valores distintos\)$/ })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Edad" })).toBeInTheDocument();
    expect(within(table).getByTestId("compare-row-price").querySelector("td")).toHaveClass("bg-row-highlight");
    expect(within(table).getByTestId("compare-row-age").querySelector("td")).not.toHaveClass("bg-row-highlight");
  });

  it("removes a product with undo", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1"), product("2")] }));
    useCompareStore.setState({ ids: ["1", "2"] });
    renderWithQuery(<CompareView />);

    await user.click(await screen.findByRole("button", { name: "Quitar Set 1 de la comparación" }));
    expect(useCompareStore.getState().ids).toEqual(["2"]);
    act(() => undo.last!.onUndo());
    expect(useCompareStore.getState().ids).toEqual(["1", "2"]);
  });

  it("undoing 'Limpiar todo' keeps ids added afterwards", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ items: [product("1"), product("2")] }));
    useCompareStore.setState({ ids: ["1", "2"] });
    renderWithQuery(<CompareView />);

    await user.click(await screen.findByRole("button", { name: "Limpiar todo" }));
    act(() => {
      useCompareStore.getState().addToCompare("5");
    });
    act(() => undo.last!.onUndo());
    expect(useCompareStore.getState().ids).toEqual(["1", "2", "5"]);
  });

  it("shows the empty state without products", () => {
    renderWithQuery(<CompareView />);
    expect(screen.getByRole("heading", { name: "No hay productos para comparar" })).toBeInTheDocument();
  });
});
