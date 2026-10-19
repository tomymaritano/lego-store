import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutFlow } from "@/app/checkout/_components/CheckoutFlow";
import type { OrderView } from "@/lib/orders/types";
import type { CheckoutPaymentsConfig } from "@/lib/payments/config";
import { useCartStore, useCheckoutStore, useCouponStore } from "@/stores";
import { makeOrder } from "../helpers/orders";

/*
 * The checkout with Mercado Pago (the store's default provider), in its test
 * mode (the mock options stand in for the Payment Brick): the payment step
 * only collects; "Realizar pedido" sends what it collected and is the only
 * call that charges; approved, cash ticket (instructions, no polling),
 * rejected (back to the payment step with the reason) and account money
 * (off to Mercado Pago). The Stripe checkout is in checkout.test.tsx.
 */

vi.mock("@/components/ui/Toast", () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), cart: vi.fn(), undo: vi.fn() },
  toast: { dismiss: () => {} },
  Toaster: () => null,
}));

const MERCADOPAGO: CheckoutPaymentsConfig = { provider: "MERCADOPAGO", mode: "mock", mercadopago: { mode: "mock", publicKey: null, missing: [] } };

const line = (id: string, price: number, quantity = 1) => ({ id, name: `Set ${id}`, price, image: "/images/lego.png", quantity, stock: 10 });

const shipping = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "1155551234",
  address: "Av. Corrientes 1234",
  city: "CABA",
  state: "Córdoba",
  zipCode: "1043",
  country: "Argentina",
};

type Handler = (url: string, init: RequestInit | undefined) => { status?: number; body: unknown } | undefined;

function mockApi(handler: Handler) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      const answer = handler(url, init) ?? { status: 500, body: { code: "server", error: "sin respuesta" } };
      return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
    })
  );
  return calls;
}

const isPrepare = (url: string, init?: RequestInit) => url === "/api/checkout/orders" && init?.method === "POST";
const isPay = (url: string) => url.endsWith("/pay");

const mpOrder = (overrides: Partial<OrderView> = {}) =>
  makeOrder({ paymentBrand: null, paymentLast4: null, payment: { provider: "MERCADOPAGO", methodType: null, installments: null, ticketUrl: null, ticketExpiresAt: null }, ...overrides });

/** Starts on the payment step with the shipping data filled in. */
async function atPayment() {
  useCheckoutStore.setState({ currentStep: "payment", shippingInfo: shipping });
  const user = userEvent.setup();
  render(<CheckoutFlow payments={MERCADOPAGO} />);
  await screen.findByTestId("mp-mock-payment");
  return user;
}

async function reviewWith(user: ReturnType<typeof userEvent.setup>, option: RegExp) {
  await user.click(screen.getByRole("radio", { name: option }));
  await user.click(screen.getByRole("button", { name: /Revisar pedido/ }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Revisa tu pedido" })).toHaveFocus());
  await screen.findByTestId("review-total");
}

describe("Checkout with Mercado Pago", { timeout: 20_000 }, () => {
  beforeAll(async () => {
    await import("@/lib/validations/resolvers");
    await useCartStore.persist.rehydrate();
    await useCouponStore.persist.rehydrate();
    window.scrollTo = vi.fn() as typeof window.scrollTo;
  });

  beforeEach(() => {
    useCheckoutStore.getState().resetCheckout();
    useCouponStore.getState().remove();
    useCartStore.setState({ cart: [line("1", 899, 2), line("2", 649)], owner: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects on the payment step, prepares the order without payment data, and charges only on 'Realizar pedido'", async () => {
    let order = mpOrder();
    const calls = mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order } };
      if (isPay(url)) {
        order = {
          ...order,
          status: "PAID",
          paidAt: "2026-10-17T15:01:05.000Z",
          submittedAt: "2026-10-17T15:01:00.000Z",
          paymentBrand: "master",
          paymentLast4: "0604",
          payment: { ...order.payment, methodType: "credit_card", installments: 3 },
        };
        return { body: { next: "done", order } };
      }
      return undefined;
    });
    const user = await atPayment();
    expect(screen.getByText(/Modo de prueba/).parentElement).toHaveTextContent("no se contacta a Mercado Pago");
    await reviewWith(user, /Mastercard aprobada en 3 cuotas/);

    expect(screen.getByTestId("review-payment")).toHaveTextContent("Mastercard •••• 0604");
    expect(screen.getByTestId("review-payment")).toHaveTextContent("3 cuotas");
    const prepare = calls.find((call) => isPrepare(call.url, { method: call.method }))!;
    expect(prepare.body).toEqual({ shipping, lines: [{ productId: "1", quantity: 2 }, { productId: "2", quantity: 1 }], provider: "MERCADOPAGO" });
    expect(calls.some((call) => isPay(call.url))).toBe(false);

    await user.click(screen.getByTestId("place-order"));
    const confirmation = await screen.findByTestId("order-confirmation");
    expect(confirmation).toHaveAttribute("data-status", "PAID");
    expect(confirmation).toHaveTextContent("Mastercard •••• 0604 · 3 cuotas");
    const pay = calls.find((call) => isPay(call.url))!;
    expect(pay.body).toEqual({
      mercadopago: {
        attemptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        method: "card",
        formData: { token: "mp_mock_installments", payment_method_id: "master", installments: 3, payer: expect.objectContaining({ email: "ana@example.com" }) },
      },
    });
    expect(useCartStore.getState().cart).toEqual([]);
  });

  it("a cash ticket shows how to pay, with the ticket's link and expiry, and does not keep polling", async () => {
    let order = mpOrder();
    const calls = mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order } };
      if (isPay(url)) {
        order = {
          ...order,
          status: "PAYMENT_PENDING",
          submittedAt: "2026-10-17T15:01:00.000Z",
          paymentBrand: "rapipago",
          payment: { ...order.payment, methodType: "ticket", ticketUrl: "https://www.mercadopago.com.ar/ticket/1", ticketExpiresAt: "2026-10-21T02:59:00.000Z" },
        };
        return { body: { next: "done", order } };
      }
      return { body: { order } };
    });
    const user = await atPayment();
    await reviewWith(user, /Rapipago/);
    expect(screen.getByTestId("review-payment")).toHaveTextContent("Rapipago (efectivo)");
    expect(screen.getByTestId("review-payment")).toHaveTextContent("generamos el ticket");

    await user.click(screen.getByTestId("place-order"));
    const confirmation = await screen.findByTestId("order-confirmation");
    expect(confirmation).toHaveAttribute("data-status", "PAYMENT_PENDING");
    expect(within(confirmation).getByRole("heading", { level: 1 })).toHaveTextContent("Recibimos tu pedido");
    const notice = within(confirmation).getByTestId("pending-payment");
    expect(notice).toHaveTextContent("en efectivo en Rapipago");
    expect(within(notice).getByTestId("ticket-expiry")).toHaveTextContent("20 de octubre");
    expect(within(notice).getByRole("link", { name: /Ver el ticket de pago/ })).toHaveAttribute("href", "https://www.mercadopago.com.ar/ticket/1");

    // A ticket can take days: no polling.
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(0);
  });

  it("a rejected card goes back to the payment step with the reason", async () => {
    mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order: mpOrder() } };
      if (isPay(url)) return { status: 402, body: { code: "declined", error: "La tarjeta no tiene fondos suficientes. Prueba con otra." } };
      return undefined;
    });
    const user = await atPayment();
    await reviewWith(user, /Mastercard sin fondos/);
    await user.click(screen.getByTestId("place-order"));
    expect(await screen.findByRole("heading", { level: 2, name: "Pago" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("fondos suficientes");
    expect(screen.queryByTestId("order-confirmation")).toBeNull();
  });

  it("account money: 'Realizar pedido' takes the customer to Mercado Pago", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const calls = mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order: mpOrder() } };
      if (isPay(url)) return { body: { next: "redirect", url: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1", order: mpOrder() } };
      return undefined;
    });
    const user = await atPayment();
    await reviewWith(user, /Cuenta de Mercado Pago/);
    expect(screen.getByTestId("review-payment")).toHaveTextContent("te llevamos a Mercado Pago");
    await user.click(screen.getByTestId("place-order"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1"));
    expect(calls.find((call) => isPay(call.url))!.body).toEqual({ mercadopago: { attemptId: expect.any(String), method: "wallet" } });
  });

  it("without Mercado Pago credentials the payment step says payments are not configured, naming the variables", async () => {
    useCheckoutStore.setState({ currentStep: "payment", shippingInfo: shipping });
    render(
      <CheckoutFlow
        payments={{
          provider: "MERCADOPAGO",
          mode: "unconfigured",
          mercadopago: { mode: "unconfigured", publicKey: null, missing: ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET"] },
        }}
      />
    );
    const notice = screen.getByTestId("payments-not-configured");
    expect(notice).toHaveTextContent("Pagos no configurados");
    expect(notice).toHaveTextContent("Mercado Pago");
    expect(notice).toHaveTextContent("MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET");
  });
});
