import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { OrderSummary } from "@/lib/orders/queries";
import type { OrderView } from "@/lib/orders/types";
import { OrderCard } from "./OrderCard";
import { OrderTimeline } from "./OrderTimeline";

/** "Mis pedidos": a row of the list (/account, /account/orders) and the status timeline of /account/orders/<id>. */

const summary = (overrides: Partial<OrderSummary> = {}): OrderSummary => ({
  id: "order_1",
  number: 1001,
  status: "PAID",
  total: 3167,
  placedAt: "2026-10-17T15:01:00.000Z",
  lineCount: 2,
  itemCount: 3,
  images: ["/images/lego.png", "/images/lego.png"],
  firstItemName: "Batmobile",
  ...overrides,
});

const order = (overrides: Partial<OrderView> = {}): OrderView => ({
  id: "order_1",
  number: 1001,
  status: "PAID",
  email: "ana@example.com",
  shippingAddress: {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.com",
    phone: "11 5555 1234",
    address: "Av. Corrientes 1234",
    city: "CABA",
    state: "Ciudad Autónoma de Buenos Aires",
    zipCode: "C1043AAZ",
    country: "Argentina",
  },
  items: [],
  subtotal: 2868,
  shipping: 299,
  total: 3167,
  paymentBrand: "visa",
  paymentLast4: "4242",
  payment: { provider: "STRIPE", methodType: null, installments: null, ticketUrl: null, ticketExpiresAt: null },
  createdAt: "2026-10-17T15:00:00.000Z",
  submittedAt: "2026-10-17T15:01:00.000Z",
  paidAt: "2026-10-17T15:01:05.000Z",
  shippedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  cancelReason: null,
  hasAccount: true,
  ...overrides,
});

const meta = {
  title: "Account/Orders",
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const OrderRows: Story = {
  render: () => (
    <ul className="space-y-3" aria-label="Pedidos">
      {(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const).map((status, index) => (
        <li key={status}>
          <OrderCard order={summary({ id: `order_${index}`, number: 1001 + index, status, lineCount: index + 1, itemCount: index + 2 })} />
        </li>
      ))}
    </ul>
  ),
};

export const OrderRowsDark: Story = { ...OrderRows, globals: { theme: "dark" } };

export const TimelinePaid: Story = { render: () => <OrderTimeline order={order()} /> };

export const TimelineDelivered: Story = {
  render: () => (
    <OrderTimeline
      order={order({ status: "DELIVERED", shippedAt: "2026-10-19T12:00:00.000Z", deliveredAt: "2026-10-22T16:30:00.000Z" })}
    />
  ),
};

export const TimelineCancelled: Story = {
  render: () => (
    <OrderTimeline order={order({ status: "CANCELLED", cancelledAt: "2026-10-17T15:02:00.000Z", cancelReason: "out_of_stock" })} />
  ),
};

export const TimelineDark: Story = { ...TimelinePaid, globals: { theme: "dark" } };
