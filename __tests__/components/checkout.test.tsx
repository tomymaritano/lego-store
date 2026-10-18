import { useEffect } from "react";
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutFlow } from "@/app/checkout/_components/CheckoutFlow";
import { Stepper } from "@/app/checkout/_components/Stepper";
import type { OrderView } from "@/lib/orders/types";
import type { PaymentsClientConfig } from "@/lib/payments/config";
import { useCartStore, useCheckoutStore } from "@/stores";
import { formatPrice as format } from "@/lib/utils";
import { makeOrder } from "../helpers/orders";

const formatPrice = (value: number) => format(value).replace(/\s/g, " ");

vi.mock("@/components/ui/Toast", () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), cart: vi.fn(), undo: vi.fn() },
  toast: { dismiss: () => {} },
  Toaster: () => null,
}));

// Stripe.js at its boundary: the Payment Element and the stripe object, as the payment step uses them.
const stripe = vi.hoisted(() => ({
  submit: vi.fn(async () => ({})),
  createConfirmationToken: vi.fn(async () => ({
    confirmationToken: { id: "ctoken_real_1", payment_method_preview: { type: "card", card: { brand: "amex", last4: "0005" } } },
  })),
  handleNextAction: vi.fn(async () => ({})),
}));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  PaymentElement: function PaymentElement({ onReady }: { onReady?: () => void }) {
    useEffect(() => onReady?.(), [onReady]);
    return <div data-testid="payment-element" />;
  },
  useStripe: () => ({ createConfirmationToken: stripe.createConfirmationToken }),
  useElements: () => ({ submit: stripe.submit }),
}));
vi.mock("@/app/checkout/_components/stripeClient", () => ({
  getStripe: async () => ({ handleNextAction: stripe.handleNextAction }),
  useStripeAppearance: () => ({ theme: "stripe" }),
  STRIPE_FONTS: [],
}));

const STRIPE: PaymentsClientConfig = { mode: "stripe", publishableKey: "pk_test_123", missing: [] };

const MOCK: PaymentsClientConfig = { mode: "mock", publishableKey: null, missing: [] };

const line = (id: string, price: number, quantity = 1) => ({
  id,
  name: `Set ${id}`,
  price,
  image: "/images/lego.png",
  quantity,
  stock: 10,
});

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

async function fillShipping(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Nombre/), "Ana");
  await user.type(screen.getByLabelText(/^Apellido/), "Pérez");
  await user.type(screen.getByLabelText(/^Email/), "ana@example.com");
  await user.type(screen.getByLabelText(/^Teléfono/), "11 5555 1234");
  await user.type(screen.getByLabelText(/^Dirección/), "Av. Corrientes 1234");
  await user.type(screen.getByLabelText(/^Ciudad/), "CABA");
  await user.type(screen.getByLabelText(/^Código postal/), "1043");
  await user.click(screen.getByRole("combobox", { name: /Provincia/ }));
  await user.click(await screen.findByRole("option", { name: "Córdoba" }));
}

type Handler = (url: string, init: RequestInit | undefined) => { status?: number; body: unknown } | undefined;

/** Answers the checkout's fetches; records them. */
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

// Form flows type a lot: slow when the whole suite runs in parallel, so every test here gets room.
describe("Checkout", { timeout: 20_000 }, () => {
  beforeAll(async () => {
    // The validators load on demand (lib/validations/lazy): warm the module so a
    // busy parallel run does not spend the first test's timeout importing zod.
    await import("@/lib/validations/resolvers");
    await useCartStore.persist.rehydrate();
    // jsdom has no scrolling; the confirmation scrolls to the top before it enters.
    window.scrollTo = vi.fn() as typeof window.scrollTo;
  });

  beforeEach(() => {
    useCheckoutStore.getState().resetCheckout();
    useCartStore.setState({ cart: [line("1", 899, 2), line("2", 649)], owner: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks the current step with aria-current and finished ones as completed", () => {
    render(<Stepper current="payment" />);
    const nav = screen.getByRole("navigation", { name: "Pasos del checkout" });
    const items = within(nav).getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent("Envío (completado)");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("shows Spanish errors on an empty shipping form and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    render(<CheckoutFlow payments={MOCK} />);
    await user.click(screen.getByRole("button", { name: /Continuar al pago/ }));
    expect(await screen.findByText("Ingresa tu nombre")).toBeInTheDocument();
    expect(screen.getByText("Elige una provincia")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/^Nombre/)).toHaveFocus();
    expect(screen.getByLabelText(/^Nombre/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^País/)).toHaveValue("Argentina");
  });

  it("shows the same totals as the cart (shipping $299 below $5000)", () => {
    render(<CheckoutFlow payments={MOCK} />);
    expect(screen.getByTestId("checkout-subtotal")).toHaveTextContent(formatPrice(2447));
    expect(screen.getByTestId("checkout-shipping")).toHaveTextContent(formatPrice(299));
    expect(screen.getByTestId("checkout-total")).toHaveTextContent(formatPrice(2746));
  });

  it("shows the checkout h1 and breadcrumb while buying; a list that does not scroll is no tab stop", () => {
    render(<CheckoutFlow payments={MOCK} />);
    expect(screen.getByRole("heading", { level: 1, name: "Finalizar compra" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Productos del pedido" });
    expect(list).not.toHaveAttribute("tabindex");
  });

  it("shows the total above the form in a collapsible summary (phones)", () => {
    render(<CheckoutFlow payments={MOCK} />);
    const summary = screen.getByText("Ver resumen").closest("summary")!;
    expect(summary).toHaveTextContent("(3 productos)");
    expect(summary).toHaveTextContent(formatPrice(2746));
    expect(within(summary.parentElement!).getByRole("list", { name: "Productos a comprar", hidden: true })).toHaveTextContent("Set 1");
    expect(within(summary.parentElement!).getByTestId("checkout-mobile-total")).toHaveTextContent(formatPrice(2746));
    expect(screen.getByRole("region", { name: "Resumen del pedido" })).toHaveClass("hidden", "lg:block");
  });

  it("goes through every step: the server prices the order, the payment is confirmed and the confirmation follows it to PAID", async () => {
    let order: OrderView = makeOrder();
    const calls = mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order } };
      if (isPay(url)) {
        order = { ...order, submittedAt: "2026-10-17T15:01:00.000Z" };
        return { body: { next: "done", order } };
      }
      // The webhook marks it paid after the first poll.
      const answer = { body: { order } };
      order = { ...order, status: "PAID", paidAt: "2026-10-17T15:01:05.000Z" };
      return answer;
    });
    const user = userEvent.setup();
    render(<CheckoutFlow payments={MOCK} />);

    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: /Continuar al pago/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pago" })).toHaveFocus());
    expect(screen.getByText(/Modo de prueba/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Visa aprobada/ }));
    await user.click(screen.getByRole("button", { name: /Revisar pedido/ }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Revisa tu pedido" })).toHaveFocus());
    expect(screen.getByTestId("review-payment")).toHaveTextContent("Visa •••• 4242");
    // The card has no holder name (the Payment Element asks none): the shipping name is not passed off as one.
    expect(screen.getByTestId("review-payment")).not.toHaveTextContent("Ana Pérez");
    expect(screen.getByTestId("review-shipping")).toHaveTextContent("Córdoba 1043");
    expect(await screen.findByTestId("review-total")).toHaveTextContent(formatPrice(2746));
    // Only ids, quantities, the address and the token go to the server: never prices.
    expect(calls[0]).toMatchObject({
      method: "POST",
      body: { lines: [{ productId: "1", quantity: 2 }, { productId: "2", quantity: 1 }], confirmationTokenId: "ctoken_mock_visa" },
    });
    expect(JSON.stringify(calls[0]!.body)).not.toContain("899");

    await user.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    const confirmation = await screen.findByTestId("order-confirmation");
    expect(within(confirmation).getByTestId("order-id")).toHaveTextContent("LEGO-001001");
    expect(within(confirmation).getByTestId("order-status")).toHaveTextContent("Pago pendiente");
    expect(screen.getByRole("heading", { level: 1, name: "Estamos confirmando tu pago" })).toBeInTheDocument();
    // The bought lines left the cart; the confirmation lists them from the order.
    expect(useCartStore.getState().cart).toHaveLength(0);
    expect(within(confirmation).getByRole("list", { name: "Productos del pedido" })).toHaveTextContent("Set 1");

    await waitFor(() => expect(within(confirmation).getByTestId("order-status")).toHaveTextContent("Pagado"), { timeout: 5_000 });
    expect(screen.getByRole("heading", { level: 1, name: "¡Gracias por tu compra!" })).toBeInTheDocument();
    expect(confirmation).toHaveTextContent("ana@example.com");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Ruta de navegación" })).toBeNull();
    expect(screen.getByRole("link", { name: /Seguir comprando/ })).toHaveAttribute("href", "/");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("a declined card goes back to the payment step with the bank's reason", async () => {
    useCheckoutStore.setState({
      currentStep: "review",
      shippingInfo: shipping,
      payment: { confirmationTokenId: "ctoken_mock_declined", brand: "visa", last4: "0002" },
    });
    mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order: makeOrder() } };
      if (isPay(url)) return { status: 402, body: { code: "declined", error: "Tu banco rechazó el pago. Prueba con otra tarjeta." } };
    });
    const user = userEvent.setup();
    render(<CheckoutFlow payments={MOCK} />);
    await screen.findByTestId("review-total");
    await user.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Pago" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Tu banco rechazó el pago");
    expect(useCheckoutStore.getState()).toMatchObject({ payment: null, isProcessing: false });
    expect(useCartStore.getState().cart).toHaveLength(2);
  });

  it("stock that ran out caps the cart and prepares the order again, saying what changed", async () => {
    useCheckoutStore.setState({
      currentStep: "review",
      shippingInfo: shipping,
      payment: { confirmationTokenId: "ctoken_mock_visa", brand: "visa", last4: "4242" },
    });
    let first = true;
    mockApi((url, init) => {
      if (!isPrepare(url, init)) return undefined;
      if (first) {
        first = false;
        return { status: 409, body: { code: "unavailable", error: "…", unavailable: [{ productId: "1", name: "Set 1", available: 1 }] } };
      }
      return { body: { order: makeOrder({ items: [makeOrder().items[0]!, makeOrder().items[1]!].map((item) => ({ ...item, quantity: 1 })), subtotal: 1548, total: 1847 }) } };
    });
    render(<CheckoutFlow payments={MOCK} />);
    expect(await screen.findByTestId("review-total")).toHaveTextContent(formatPrice(1847));
    expect(screen.getByText(/Actualizamos tu carrito: de Set 1 queda 1 unidad/)).toBeInTheDocument();
    expect(useCartStore.getState().cart.find((item) => item.id === "1")?.quantity).toBe(1);
  });

  it("with Stripe: the Payment Element only collects (ConfirmationToken), and 3D Secure is finished with handleNextAction", async () => {
    useCheckoutStore.setState({ currentStep: "payment", shippingInfo: shipping });
    const order = makeOrder({ paymentBrand: "amex", paymentLast4: "0005" });
    const calls = mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order } };
      if (isPay(url)) return { body: { next: "action", clientSecret: "pi_1_secret_2", order } };
      return { body: { order } };
    });
    const user = userEvent.setup();
    render(<CheckoutFlow payments={STRIPE} />);
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Revisar pedido/ }));

    await waitFor(() => expect(stripe.createConfirmationToken).toHaveBeenCalled());
    expect(stripe.submit).toHaveBeenCalled();
    expect(stripe.createConfirmationToken).toHaveBeenCalledWith({
      elements: expect.anything(),
      params: {
        payment_method_data: {
          billing_details: expect.objectContaining({
            name: "Ana Pérez",
            email: "ana@example.com",
            address: expect.objectContaining({ country: "AR", postal_code: "1043", state: "Córdoba" }),
          }),
        },
      },
    });
    expect(await screen.findByTestId("review-payment")).toHaveTextContent("American Express •••• 0005");
    expect(calls[0]!.body).toMatchObject({ confirmationTokenId: "ctoken_real_1" });

    await screen.findByTestId("review-total");
    await user.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    await waitFor(() => expect(stripe.handleNextAction).toHaveBeenCalledWith({ clientSecret: "pi_1_secret_2" }));
    expect(await screen.findByTestId("order-confirmation")).toBeInTheDocument();
  });

  it("with Stripe: a failed 3D Secure goes back to the payment step", async () => {
    useCheckoutStore.setState({
      currentStep: "review",
      shippingInfo: shipping,
      payment: { confirmationTokenId: "ctoken_real_1", brand: "visa", last4: "3184" },
    });
    stripe.handleNextAction.mockResolvedValueOnce({ error: { message: "No pudimos autenticar tu método de pago." } } as never);
    mockApi((url, init) => {
      if (isPrepare(url, init)) return { body: { order: makeOrder() } };
      if (isPay(url)) return { body: { next: "action", clientSecret: "pi_1_secret_2", order: makeOrder() } };
    });
    const user = userEvent.setup();
    render(<CheckoutFlow payments={STRIPE} />);
    await screen.findByTestId("review-total");
    await user.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Pago" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos autenticar");
    expect(screen.queryByTestId("order-confirmation")).toBeNull();
  });

  it("without Stripe keys the payment step says payments are not configured", () => {
    useCheckoutStore.setState({ currentStep: "payment", shippingInfo: shipping });
    render(
      <CheckoutFlow payments={{ mode: "unconfigured", publishableKey: null, missing: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] }} />
    );
    expect(screen.getByTestId("payments-not-configured")).toHaveTextContent("Pagos no configurados");
    expect(screen.getByTestId("payments-not-configured")).toHaveTextContent("STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET");
    expect(screen.getByRole("button", { name: /Revisar pedido/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("goes back from payment to shipping keeping the address", async () => {
    const user = userEvent.setup();
    render(<CheckoutFlow payments={MOCK} />);
    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: /Continuar al pago/ }));
    await user.click(await screen.findByRole("button", { name: /Volver a envío/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Datos de envío" })).toHaveFocus());
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Ana");
  });

  it("a confirmation left from an earlier visit is not shown again", async () => {
    useCartStore.setState({ cart: [] });
    useCheckoutStore.setState({ currentStep: "confirmation", order: makeOrder({ status: "PAID" }), shippingInfo: shipping });
    render(<CheckoutFlow payments={MOCK} />);
    expect(screen.queryByTestId("order-confirmation")).toBeNull();
    await waitFor(() => expect(useCheckoutStore.getState()).toMatchObject({ currentStep: "shipping", order: null }));
  });
});
