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
  shipping: 299,
  total: 3167,
  paymentBrand: "visa",
  paymentLast4: "4242",
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

export const PaymentTestMode: Story = {
  render: () => (
    <PaymentStep
      payments={{ mode: "mock", publishableKey: null, missing: [] }}
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
      payments={{ mode: "mock", publishableKey: null, missing: [] }}
      shipping={shipping}
      amount={3167}
      previous={null}
      error="Tu banco rechazó el pago. Prueba con otra tarjeta."
      focusHeading={false}
      onSubmit={noop}
      onBack={noop}
    />
  ),
};

export const PaymentsNotConfigured: Story = {
  render: () => (
    <PaymentStep
      payments={{ mode: "unconfigured", publishableKey: null, missing: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"] }}
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

export const ConfirmingPayment: Story = { render: () => <ConfirmationStep order={order()} canViewInAccount={false} /> };

export const Paid: Story = {
  render: () => <ConfirmationStep order={order({ status: "PAID", paidAt: "2026-10-17T15:01:05.000Z", hasAccount: true })} canViewInAccount />,
};

export const PaidDark: Story = { ...Paid, globals: { theme: "dark" } };

export const CancelledOutOfStock: Story = {
  render: () => (
    <ConfirmationStep
      order={order({ status: "CANCELLED", cancelledAt: "2026-10-17T15:01:06.000Z", cancelReason: "out_of_stock" })}
      canViewInAccount={false}
    />
  ),
};
