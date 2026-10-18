import type { CheckoutPaymentsConfig } from "@/lib/payments/config";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import type { OrderView } from "@/lib/orders/types";
import { ConfirmationStep } from "./ConfirmationStep";
import { PaymentStep } from "./PaymentStep";
import { ShippingStep } from "./ShippingStep";

/**
 * Checkout steps that depend on the server: the payment step in its test
 * (STRIPE_MOCK) and "not configured" states (the Stripe Payment Element is an
 * iframe from js.stripe.com, not rendered here), and the confirmation while
 * the payment is confirmed, once paid, and cancelled for lack of stock.
 */

const shipping = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "11 5555 1234",
  address: "Av. Corrientes 1234",
  city: "CABA",
  state: "Ciudad Autónoma de Buenos Aires",
  zipCode: "C1043AAZ",
  country: "Argentina",
};

const order = (overrides: Partial<OrderView> = {}): OrderView => ({
  id: "order_1",
  number: 1001,
  status: "PENDING",
  email: "ana@example.com",
  shippingAddress: shipping,
  items: [
    { productId: "7", name: "Batmobile", unitPrice: 2490, image: "/images/lego.png", quantity: 1 },
    { productId: "5", name: "Tusken Raider", unitPrice: 189, image: "/images/lego.png", quantity: 2 },
  ],
  subtotal: 2868,
  discount: 0,
  couponCode: null,
  shipping: 299,
  total: 3167,
  paymentBrand: "visa",
  paymentLast4: "4242",
  payment: { provider: "STRIPE", methodType: null, installments: null, ticketUrl: null, ticketExpiresAt: null },
  createdAt: "2026-10-17T15:00:00.000Z",
  submittedAt: "2026-10-17T15:01:00.000Z",
  paidAt: null,
  shippedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  cancelReason: null,
  hasAccount: false,
  ...overrides,
});

const meta = {
  title: "Checkout/Steps",
  // The steps slide and fade in: axe checks contrast once they have settled.
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const moving = Array.from(canvasElement.querySelectorAll<HTMLElement>("[style]")).filter(
          (element) => element.style.opacity !== "" && element.style.opacity !== "1"
        );
        expect(moving).toHaveLength(0);
      },
      { timeout: 3000 }
    );
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/** Signed in: the name and email come from the account, and the hint says the order is tied to it. */
export const ShippingSignedIn: Story = {
  render: () => (
    <ShippingStep initialData={null} account={{ name: "Ana Pérez", email: "ana@example.com" }} focusHeading={false} onSubmit={noop} />
  ),
  play: async (context) => {
    await meta.play(context);
    const email = context.canvasElement.querySelector<HTMLInputElement>('input[type="email"]');
    await expect(email?.value).toBe("ana@example.com");
    await expect(context.canvasElement.textContent).toContain("asociado a tu cuenta");
  },
};

const MP_MOCK: CheckoutPaymentsConfig = { provider: "MERCADOPAGO", mode: "mock", mercadopago: { mode: "mock", publicKey: null, missing: [] } };

export const PaymentTestMode: Story = {
  render: () => (
    <PaymentStep
      payments={MP_MOCK}
      shipping={shipping}
      amount={3167}
      previous={null}
      error={null}
      focusHeading={false}
      onSubmit={noop}
      onBack={noop}
    />
  ),
};

export const PaymentTestModeStripe: Story = {
  render: () => (
    <PaymentStep
      payments={{ provider: "STRIPE", mode: "mock", stripe: { mode: "mock", publishableKey: null, missing: [] } }}
      shipping={shipping}
      amount={3167}
      previous={null}
      error={null}
      focusHeading={false}
      onSubmit={noop}
      onBack={noop}
    />
  ),
};

export const PaymentDeclined: Story = {
  render: () => (
    <PaymentStep
      payments={MP_MOCK}
      shipping={shipping}
      amount={3167}
      previous={null}
      error="La tarjeta no tiene fondos suficientes. Prueba con otra."
      focusHeading={false}
      onSubmit={noop}
      onBack={noop}
    />
  ),
};

export const PaymentsNotConfigured: Story = {
  render: () => (
    <PaymentStep
      payments={{
        provider: "MERCADOPAGO",
        mode: "unconfigured",
        mercadopago: {
          mode: "unconfigured",
          publicKey: null,
          missing: ["MERCADOPAGO_ACCESS_TOKEN", "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET"],
        },
      }}
      shipping={shipping}
      amount={3167}
      previous={null}
      error={null}
      focusHeading={false}
      onSubmit={noop}
      onBack={noop}
    />
  ),
};

export const PaymentsNotConfiguredDark: Story = { ...PaymentsNotConfigured, globals: { theme: "dark" } };

/** What the customer sees first when the store cannot take payments: the notice, with "Continuar al pago" off. */
export const ShippingPaymentsUnavailable: Story = {
  render: () => <ShippingStep initialData={null} paymentsUnavailable={{ provider: "MERCADOPAGO", missing: [] }} focusHeading={false} onSubmit={noop} />,
};

export const ShippingPaymentsUnavailableDark: Story = { ...ShippingPaymentsUnavailable, globals: { theme: "dark" } };

export const ConfirmingPayment: Story = { render: () => <ConfirmationStep order={order()} canViewInAccount={false} /> };

export const Paid: Story = {
  render: () => <ConfirmationStep order={order({ status: "PAID", paidAt: "2026-10-17T15:01:05.000Z", hasAccount: true })} canViewInAccount />,
};

export const PaidDark: Story = { ...Paid, globals: { theme: "dark" } };

/** Mercado Pago: the order is placed and waits for a cash ticket to be paid. */
export const WaitingForCashPayment: Story = {
  render: () => (
    <ConfirmationStep
      order={order({
        status: "PAYMENT_PENDING",
        paymentBrand: "rapipago",
        paymentLast4: null,
        payment: {
          provider: "MERCADOPAGO",
          methodType: "ticket",
          installments: 1,
          ticketUrl: "https://www.mercadopago.com.ar/payments/123/ticket",
          ticketExpiresAt: "2026-10-21T02:59:00.000Z",
        },
      })}
      canViewInAccount={false}
    />
  ),
};

export const WaitingForCashPaymentDark: Story = { ...WaitingForCashPayment, globals: { theme: "dark" } };

export const CancelledOutOfStock: Story = {
  render: () => (
    <ConfirmationStep
      order={order({ status: "CANCELLED", cancelledAt: "2026-10-17T15:01:06.000Z", cancelReason: "out_of_stock" })}
      canViewInAccount={false}
    />
  ),
};
