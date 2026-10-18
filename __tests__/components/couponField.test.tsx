import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { formatPrice as format } from "@/lib/utils";
import { useCartStore, useCouponStore } from "@/stores";
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
    await useCartStore.persist.rehydrate();
  });

  beforeEach(() => {
    useCouponStore.getState().remove();
    useCartStore.setState({ cart: [], owner: null });
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
    useCouponStore.getState().apply(QUOTE.coupon as never, null);
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

  describe("the applied coupon is asked about again when the page loads", () => {
    /** A coupon applied on an earlier visit: stored, not yet confirmed in this page load. */
    const stored = (terms: object) => useCouponStore.setState({ coupon: terms as never, owner: null, checked: null, notice: null });

    beforeEach(() => {
      useCartStore.setState({ cart: [line("7", 2490)], owner: null });
    });

    it("leaves the discount out until the server answers, then adopts its terms (an admin changed the value)", async () => {
      stored({ ...QUOTE.coupon, value: 50, label: "50% de descuento", recheckToken: "token-from-apply" });
      let answer: (response: Response) => void = () => {};
      requests = [];
      globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return new Promise<Response>((resolve) => (answer = resolve));
      }) as typeof fetch;
      render(<OrderSummary lines={[line("7", 2490)]} />);

      expect(screen.getByTestId("cart-coupon-checking")).toHaveTextContent("Comprobando que siga vigente");
      expect(screen.queryByTestId("cart-discount")).toBeNull();
      expect(text(screen.getByTestId("cart-total"))).toBe(formatPrice(2490 + 299));
      await waitFor(() => expect(requests).toHaveLength(1));
      // The token its quote came with: only that gets the re-checks' rate limit (src/lib/coupons/recheck.ts).
      expect(requests[0]).toEqual({
        url: "/api/checkout/coupon",
        body: { code: "BIENVENIDA10", lines: [{ productId: "7", quantity: 1 }], recheck: true, recheckToken: "token-from-apply" },
      });

      answer(new Response(JSON.stringify({ ...QUOTE, coupon: { ...QUOTE.coupon, recheckToken: "token-renewed" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
      await waitFor(() => expect(text(screen.getByTestId("cart-discount"))).toBe(formatPrice(249)));
      expect(useCouponStore.getState().coupon).toMatchObject({ value: 10, label: "10% de descuento", recheckToken: "token-renewed" });
      expect(screen.queryByTestId("cart-coupon-checking")).toBeNull();
    });

    it("takes off a coupon the server no longer accepts, with its reason on the field", async () => {
      stored(QUOTE.coupon);
      stubFetch(422, { code: "coupon", rejection: "inactive", error: "Este cupón ya no está disponible." });
      render(<OrderSummary lines={[line("7", 2490)]} />);

      expect(await screen.findByRole("alert")).toHaveTextContent("Quitamos el cupón BIENVENIDA10: Este cupón ya no está disponible.");
      expect(screen.getByLabelText("Código de descuento")).toHaveAttribute("aria-invalid", "true");
      expect(useCouponStore.getState().coupon).toBeNull();
      expect(screen.queryByTestId("cart-discount")).toBeNull();
      expect(text(screen.getByTestId("cart-total"))).toBe(formatPrice(2490 + 299));

      // Typing a new code clears the notice.
      await userEvent.setup().type(screen.getByLabelText("Código de descuento"), "O");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("keeps the stored terms when the server cannot be asked (the order checks them again)", async () => {
      stored(QUOTE.coupon);
      stubFetch(429, { code: "rate_limited", error: "Hiciste demasiados intentos." });
      render(<OrderSummary lines={[line("7", 2490)]} />);
      await waitFor(() => expect(text(screen.getByTestId("cart-discount"))).toBe(formatPrice(249)));
      expect(useCouponStore.getState().coupon?.code).toBe("BIENVENIDA10");
    });
  });
});
