import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { formatPrice as format } from "@/lib/utils";
import { useCouponStore } from "@/stores";
import type { CartItem } from "@/types";

/*
 * The coupon field in the cart's summary: the server decides (POST
 * /api/checkout/coupon, stubbed here) and the totals show the discount with
 * lib/pricing as the cart changes.
 */

const formatPrice = (value: number) => format(value).replace(/\s/g, " ");
const text = (element: HTMLElement) => (element.textContent ?? "").replace(/\s/g, " ");

const line = (id: string, price: number, quantity = 1): CartItem => ({ id, name: `Set ${id}`, price, image: "/images/lego.png", quantity, stock: 10 });

const QUOTE = {
  coupon: { code: "BIENVENIDA10", type: "PERCENT", value: 10, minSubtotal: 2000, label: "10% de descuento" },
  totals: { subtotal: 2490, discount: 249, shipping: 299, total: 2540, count: 1, coupon: { code: "BIENVENIDA10", applies: true, shortBy: 0 } },
};

let requests: { url: string; body: unknown }[] = [];
function stubFetch(status: number, body: unknown) {
  requests = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

const realFetch = globalThis.fetch;

describe("Coupon field (cart summary)", () => {
  beforeAll(async () => {
    await useCouponStore.persist.rehydrate();
  });

  beforeEach(() => {
    useCouponStore.getState().remove();
    window.localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("applies a code the server accepts: the discount shows in the totals and the coupon is kept", async () => {
    const user = userEvent.setup();
    stubFetch(200, QUOTE);
    render(<OrderSummary lines={[line("7", 2490)]} />);

    await user.type(screen.getByLabelText("Código de descuento"), "bienvenida10");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    const applied = await screen.findByTestId("cart-coupon-applied");
    expect(applied).toHaveTextContent("BIENVENIDA10");
    expect(applied).toHaveTextContent("10% de descuento");
    expect(requests).toEqual([{ url: "/api/checkout/coupon", body: { code: "bienvenida10", lines: [{ productId: "7", quantity: 1 }] } }]);
    expect(text(screen.getByTestId("cart-discount"))).toBe(formatPrice(249));
    expect(text(screen.getByTestId("cart-total"))).toBe(formatPrice(2540));
    expect(screen.getByRole("status")).toHaveTextContent("Aplicamos el cupón BIENVENIDA10: 10% de descuento.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Quitar el cupón BIENVENIDA10" })).toHaveFocus());
    expect(useCouponStore.getState().coupon?.code).toBe("BIENVENIDA10");
    expect(JSON.parse(window.localStorage.getItem("lego-coupon-storage") ?? "{}").state.coupon.code).toBe("BIENVENIDA10");
  });

  it("shows the server's reason when it refuses the code, on the field", async () => {
    const user = userEvent.setup();
    stubFetch(422, { code: "coupon", rejection: "expired", error: "Este cupón venció: era válido hasta el 31 de enero de 2025." });
    render(<OrderSummary lines={[line("7", 2490)]} />);

    const input = screen.getByLabelText("Código de descuento");
    await user.type(input, "VIEJO");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Este cupón venció");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    expect(screen.queryByTestId("cart-discount")).toBeNull();
    expect(useCouponStore.getState().coupon).toBeNull();
  });

  it("asks for a code before calling the server", async () => {
    const user = userEvent.setup();
    stubFetch(200, QUOTE);
    render(<OrderSummary lines={[line("7", 2490)]} />);
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe el código de tu cupón.");
    expect(requests).toEqual([]);
  });

  it("follows the cart: below the minimum it says what is missing and discounts nothing; removing it puts the field back", async () => {
    const user = userEvent.setup();
    useCouponStore.getState().apply(QUOTE.coupon as never);
    const { rerender } = render(<OrderSummary lines={[line("5", 189, 2)]} />);

    const applied = screen.getByTestId("cart-coupon-applied");
    expect(text(within(applied).getByTestId("cart-coupon-short"))).toBe(`Se aplica desde ${formatPrice(2000)}: te faltan ${formatPrice(2000 - 378)}.`);
    expect(screen.queryByTestId("cart-discount")).toBeNull();

    rerender(<OrderSummary lines={[line("5", 189, 2), line("7", 2490)]} />);
    // 10% of $2868 = $286.80 → $287.
    await waitFor(() => expect(text(screen.getByTestId("cart-discount"))).toBe(formatPrice(287)));
    expect(screen.queryByTestId("cart-coupon-short")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Quitar el cupón BIENVENIDA10" }));
    await waitFor(() => expect(screen.getByLabelText("Código de descuento")).toHaveFocus());
    expect(useCouponStore.getState().coupon).toBeNull();
    await waitFor(() => expect(screen.queryByTestId("cart-discount")).toBeNull());
  });
});
