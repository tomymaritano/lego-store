import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProductCard } from "@/components/product/ProductCard";
import { QuickViewModal } from "@/components/product/QuickViewModal";
import { useWishlistStore, useCartStore, useUiStore } from "@/stores";
import { getProductById } from "@/lib/api";
import type { Product } from "@/types";

let product: Product;

describe("ProductCard store subscriptions", () => {
  beforeEach(async () => {
    product = (await getProductById("1"))!;
    act(() => {
      useWishlistStore.setState({ wishlist: [] });
      useCartStore.setState({ cart: [] });
    });
  });

  it("updates the wishlist button after toggling", () => {
    render(<ProductCard product={product} />);

    fireEvent.click(screen.getByRole("button", { name: `Agregar ${product.name} a favoritos` }));

    expect(screen.getByRole("button", { name: `Quitar ${product.name} de favoritos` })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("re-renders when the wishlist changes elsewhere", () => {
    render(<ProductCard product={product} />);

    act(() => {
      useWishlistStore.getState().addToWishlist(product);
    });

    expect(screen.getByRole("button", { name: `Quitar ${product.name} de favoritos` })).toBeInTheDocument();
  });

  it("adds to the cart and keeps the focused button enabled, now opening the cart", async () => {
    render(<ProductCard product={product} />);
    const button = screen.getByTestId("add-to-cart-btn");
    button.focus();

    fireEvent.click(button);

    expect(useCartStore.getState().cart.map((line) => line.id)).toEqual([product.id]);
    // A self-disabling button would drop keyboard focus to <body>.
    expect(button).toBeEnabled();
    expect(button).toHaveFocus();
    await waitFor(() => expect(button).toHaveTextContent("Ver carrito"));

    fireEvent.click(button);
    expect(useUiStore.getState().cartDrawerOpen).toBe(true);
    expect(useCartStore.getState().cart[0].quantity).toBe(1);
  });

  it("does not make the card itself a keyboard stop", () => {
    const { container } = render(<ProductCard product={product} />);
    expect(container.querySelector("article")).not.toHaveAttribute("tabindex");
  });

  it("links the whole card to the product page without nesting buttons in the link", () => {
    render(<ProductCard product={product} />);
    const link = screen.getByRole("link", { name: product.name });
    expect(link).toHaveAttribute("href", `/item/${product.id}`);
    expect(link.querySelector("button")).toBeNull();
  });
});

describe("QuickViewModal", () => {
  beforeEach(async () => {
    product = (await getProductById("1"))!;
  });

  it("calls onClose when Escape is pressed while open", () => {
    const onClose = vi.fn();
    render(<QuickViewModal product={product} isOpen onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while closed", () => {
    const onClose = vi.fn();
    render(<QuickViewModal product={product} isOpen={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});
