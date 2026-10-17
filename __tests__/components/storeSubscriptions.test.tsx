import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProductCard } from "@/components/product/ProductCard";
import { QuickViewModal } from "@/components/ui/QuickViewModal";
import { useWishlistStore, useCartStore } from "@/stores";
import { products } from "@/data/products";

const product = products[0];

describe("ProductCard store subscriptions", () => {
  beforeEach(() => {
    act(() => {
      useWishlistStore.setState({ wishlist: [] });
      useCartStore.setState({ cart: [] });
    });
  });

  it("updates the wishlist button after toggling", () => {
    render(<ProductCard product={product} />);

    const button = screen.getByRole("button", { name: "Agregar a favoritos" });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Quitar de favoritos" })).toBeInTheDocument();
  });

  it("re-renders when the wishlist changes elsewhere", () => {
    render(<ProductCard product={product} />);

    act(() => {
      useWishlistStore.getState().addToWishlist(product);
    });

    expect(screen.getByRole("button", { name: "Quitar de favoritos" })).toBeInTheDocument();
  });
});

describe("QuickViewModal", () => {
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
