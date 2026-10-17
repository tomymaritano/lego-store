import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutFlow } from "@/app/checkout/_components/CheckoutFlow";
import { Stepper } from "@/app/checkout/_components/Stepper";
import { useCartStore, useCheckoutStore } from "@/stores";
import { showToast } from "@/components/ui/Toast";
import { formatPrice as format } from "@/lib/utils";

const formatPrice = (value: number) => format(value).replace(/\s/g, " ");

vi.mock("@/components/ui/Toast", () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), cart: vi.fn(), undo: vi.fn() },
  toast: { dismiss: () => {} },
  Toaster: () => null,
}));

const line = (id: string, price: number, quantity = 1) => ({
  id,
  name: `Set ${id}`,
  price,
  image: "/images/lego.png",
  quantity,
  stock: 10,
});

const nextYear = String((new Date().getFullYear() + 1) % 100).padStart(2, "0");

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

describe("Checkout", () => {
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
    useCartStore.setState({ cart: [line("1", 899, 2), line("2", 649)] });
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
    render(<CheckoutFlow />);
    await user.click(screen.getByRole("button", { name: /Continuar al pago/ }));
    expect(await screen.findByText("Ingresa tu nombre")).toBeInTheDocument();
    expect(screen.getByText("Elige una provincia")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/^Nombre/)).toHaveFocus();
    expect(screen.getByLabelText(/^Nombre/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^País/)).toHaveValue("Argentina");
  });

  it("shows the same totals as the cart (shipping $299 below $5000)", () => {
    render(<CheckoutFlow />);
    expect(screen.getByTestId("checkout-subtotal")).toHaveTextContent(formatPrice(2447));
    expect(screen.getByTestId("checkout-shipping")).toHaveTextContent(formatPrice(299));
    expect(screen.getByTestId("checkout-total")).toHaveTextContent(formatPrice(2746));
  });

  it("shows the checkout h1 and breadcrumb while buying; a list that does not scroll is no tab stop", () => {
    render(<CheckoutFlow />);
    expect(screen.getByRole("heading", { level: 1, name: "Finalizar compra" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Productos del pedido" });
    expect(list).not.toHaveAttribute("tabindex");
  });

  it("shows the total above the form in a collapsible summary (phones)", () => {
    render(<CheckoutFlow />);
    const summary = screen.getByText("Ver resumen").closest("summary")!;
    expect(summary).toHaveTextContent("(3 productos)");
    expect(summary).toHaveTextContent(formatPrice(2746));
    expect(within(summary.parentElement!).getByRole("list", { name: "Productos a comprar", hidden: true })).toHaveTextContent("Set 1");
  });

  it("goes through every step, keeps only a card summary and confirms the order", async () => {
    const user = userEvent.setup();
    render(<CheckoutFlow />);

    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: /Continuar al pago/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pago" })).toHaveFocus());
    expect(useCheckoutStore.getState().shippingInfo).toMatchObject({ state: "Córdoba", country: "Argentina" });

    const number = screen.getByLabelText(/^Número de tarjeta/);
    await user.type(number, "4242424242424242");
    expect(number).toHaveValue("4242 4242 4242 4242");
    expect(screen.getByTestId("card-brand")).toHaveTextContent("Visa");
    await user.type(screen.getByLabelText(/^Nombre en la tarjeta/), "ANA PEREZ");
    await user.type(screen.getByLabelText(/^Vencimiento/), `12${nextYear}`);
    expect(screen.getByLabelText(/^Vencimiento/)).toHaveValue(`12/${nextYear}`);
    await user.type(screen.getByLabelText(/^Código de seguridad/), "1234");
    expect(screen.getByLabelText(/^Código de seguridad/)).toHaveValue("123");
    await user.click(screen.getByRole("button", { name: /Revisar pedido/ }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Revisa tu pedido" })).toHaveFocus());
    expect(screen.getByTestId("review-payment")).toHaveTextContent("Visa •••• 4242");
    expect(screen.getByTestId("review-shipping")).toHaveTextContent("Córdoba 1043");
    expect(screen.getByTestId("review-total")).toHaveTextContent(formatPrice(2746));
    const stored = JSON.stringify(useCheckoutStore.getState());
    expect(stored).not.toContain("4242 4242");
    expect(stored).not.toContain('"123"');

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await user.click(screen.getByRole("button", { name: /Confirmar pedido/ }));
      expect(screen.getByTestId("place-order")).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("status")).toHaveTextContent("Procesando el pago…");
      await vi.runAllTimersAsync();
    } finally {
      vi.useRealTimers();
    }

    const confirmation = await screen.findByTestId("order-confirmation");
    expect(within(confirmation).getByTestId("order-id").textContent).toMatch(/^LEGO-/);
    expect(confirmation).toHaveTextContent(formatPrice(2746));
    expect(confirmation).toHaveTextContent("ana@example.com");
    // What was bought stays listed even though the cart is now empty.
    const bought = within(confirmation).getByRole("list", { name: "Productos comprados" });
    expect(within(bought).getAllByRole("listitem")).toHaveLength(2);
    expect(bought).toHaveTextContent("Set 1");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "¡Gracias por tu compra!" })).toHaveFocus());
    // The order is done: the "Finalizar compra" heading and the checkout breadcrumb are gone.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Ruta de navegación" })).toBeNull();
    expect(useCartStore.getState().cart).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Seguir comprando/ })).toHaveAttribute("href", "/");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  }, 20_000); // a lot of typing: slow when the whole suite runs in parallel

  it("goes back from payment to shipping keeping the address", async () => {
    const user = userEvent.setup();
    render(<CheckoutFlow />);
    await fillShipping(user);
    await user.click(screen.getByRole("button", { name: /Continuar al pago/ }));
    await user.click(await screen.findByRole("button", { name: /Volver a envío/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Datos de envío" })).toHaveFocus());
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Ana");
  });

  it("validates the card step", async () => {
    useCheckoutStore.setState({
      currentStep: "payment",
      shippingInfo: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        phone: "1155551234",
        address: "Av. Corrientes 1234",
        city: "CABA",
        state: "Córdoba",
        zipCode: "1043",
        country: "Argentina",
      },
    });
    const user = userEvent.setup();
    render(<CheckoutFlow />);
    await user.type(screen.getByLabelText(/^Número de tarjeta/), "4242424242424241");
    await user.click(screen.getByRole("button", { name: /Revisar pedido/ }));
    expect(await screen.findByText(/no es una tarjeta válida/)).toBeInTheDocument();
    expect(screen.getByText("Ingresa el vencimiento")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Número de tarjeta/)).toHaveFocus();
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
  const summary = { brand: "visa" as const, last4: "4242", cardName: "ANA PEREZ", expiryDate: `12/${nextYear}` };

  it("leaving while the payment runs cancels the order and keeps the cart", async () => {
    useCheckoutStore.setState({ currentStep: "review", shippingInfo: shipping, paymentSummary: summary });
    const user = userEvent.setup();
    vi.mocked(showToast.error).mockClear();
    vi.mocked(showToast.info).mockClear();
    const { unmount } = render(<CheckoutFlow />);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await user.click(screen.getByRole("button", { name: /Confirmar pedido/ }));
      expect(useCheckoutStore.getState().isProcessing).toBe(true);
      unmount();
      await vi.runAllTimersAsync();
    } finally {
      vi.useRealTimers();
    }
    expect(showToast.info).toHaveBeenCalledWith(expect.stringContaining("Cancelamos el pago"));
    expect(showToast.error).not.toHaveBeenCalled();
    expect(useCartStore.getState().cart).toHaveLength(2);
    expect(useCheckoutStore.getState()).toMatchObject({ currentStep: "review", isProcessing: false, orderId: null });
  });

  it("a confirmation left from an earlier visit is not shown again", async () => {
    useCartStore.setState({ cart: [] });
    useCheckoutStore.setState({ currentStep: "confirmation", orderId: "LEGO-OLD", orderTotal: 1198, shippingInfo: shipping });
    render(<CheckoutFlow />);
    expect(screen.queryByTestId("order-confirmation")).toBeNull();
    await waitFor(() => expect(useCheckoutStore.getState()).toMatchObject({ currentStep: "shipping", orderId: null }));
  });
});
