import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { StoreHydrator, useCartCount, useCartStore, useStoresHydrated } from "@/stores";

function CartBadge() {
  const hydrated = useStoresHydrated();
  const count = useCartCount();
  return <span data-testid="badge">{hydrated ? count : "…"}</span>;
}

describe("store hydration", () => {
  beforeEach(() => {
    useCartStore.setState({ cart: [] });
  });

  it("renders defaults first, then the persisted state once StoreHydrator mounts", async () => {
    localStorage.setItem(
      "lego-cart-storage",
      JSON.stringify({
        state: { cart: [{ id: "1", name: "Rex", price: 899, image: "/rex.png", quantity: 2, stock: 3 }] },
        version: 1,
      })
    );

    // Without the hydrator nothing reads localStorage (server render = first client render).
    const { unmount } = render(<CartBadge />);
    expect(screen.getByTestId("badge")).toHaveTextContent("…");
    unmount();

    await act(async () => {
      render(
        <>
          <StoreHydrator />
          <CartBadge />
        </>
      );
    });
    expect(screen.getByTestId("badge")).toHaveTextContent("2");
  });

});
