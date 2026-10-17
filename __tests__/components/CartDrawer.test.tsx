import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCartStore } from "@/stores";
import { siteConfig } from "@/config/site";
import { formatPrice as format } from "@/lib/utils";

/** formatPrice with plain spaces (toHaveTextContent normalises the received text only). */
const formatPrice = (value: number) => format(value).replace(/\s/g, " ");

vi.mock("@/components/ui/Toast", () => ({ showToast: {}, toast: { dismiss: vi.fn() }, Toaster: () => null }));

const line = (id: string, price: number, quantity = 1) => ({
  id,
  name: `Set ${id}`,
  price,
  image: "/images/lego.png",
  quantity,
  stock: 5,
});

describe("CartDrawer", () => {
  beforeAll(async () => {
    await useCartStore.persist.rehydrate();
  });

  beforeEach(() => {
    useCartStore.setState({ cart: [] });
  });

  it("shows the empty state with a way back to the catalogue", () => {
    const onClose = vi.fn();
    render(<CartDrawer isOpen onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Carrito" });
    expect(within(dialog).getByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Explorar productos/ })).toHaveAttribute("href", "/");
  });

  it("lists the lines with line totals, shipping and the remaining amount for free shipping", () => {
    useCartStore.setState({ cart: [line("1", 1000, 2), line("2", 500)] });
    render(<CartDrawer isOpen onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Carrito (3)" });
    expect(within(dialog).getAllByTestId("cart-item")).toHaveLength(2);
    expect(within(dialog).getByRole("link", { name: "Set 1" })).toHaveAttribute("href", "/item/1");
    expect(within(dialog).getAllByTestId("cart-item")[0]).toHaveTextContent(
      `${formatPrice(2000)}${formatPrice(1000)} c/u`
    );

    const { freeShippingThreshold, shippingCost } = siteConfig.commerce;
    expect(within(dialog).getByTestId("free-shipping")).toHaveTextContent(
      `Te faltan ${formatPrice(freeShippingThreshold - 2500)} para el envío gratis`
    );
    expect(within(dialog).getByTestId("cart-drawer-total")).toHaveTextContent(formatPrice(2500 + shippingCost));
    expect(within(dialog).getByRole("link", { name: "Finalizar compra" })).toHaveAttribute("href", "/checkout");
    expect(within(dialog).getByRole("link", { name: "Ver carrito" })).toHaveAttribute("href", "/cart");
  });

  it("celebrates free shipping once the subtotal reaches the threshold", () => {
    useCartStore.setState({ cart: [line("1", siteConfig.commerce.freeShippingThreshold)] });
    render(<CartDrawer isOpen onClose={() => {}} />);
    expect(screen.getByTestId("free-shipping")).toHaveTextContent("¡Tienes envío gratis!");
    expect(screen.getByText("Gratis")).toBeInTheDocument();
  });

  it("updates quantities and removes lines", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ cart: [line("1", 1000)] });
    render(<CartDrawer isOpen onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Aumentar/ }));
    expect(useCartStore.getState().cart[0].quantity).toBe(2);

    await user.click(screen.getByRole("button", { name: "Eliminar Set 1 del carrito" }));
    expect(useCartStore.getState().cart).toEqual([]);
  });
});
