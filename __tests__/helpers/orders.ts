import type { OrderView } from "@/lib/orders/types";

/** An order as the checkout Route Handlers return it (OrderView). */
export function makeOrder(overrides: Partial<OrderView> = {}): OrderView {
  return {
    id: "order_1",
    number: 1001,
    status: "PENDING",
    email: "ana@example.com",
    shippingAddress: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "11 5555 1234",
      address: "Av. Corrientes 1234",
      city: "CABA",
      state: "Córdoba",
      zipCode: "1043",
      country: "Argentina",
    },
    items: [
      { productId: "1", name: "Set 1", unitPrice: 899, image: "/images/lego.png", quantity: 2 },
      { productId: "2", name: "Set 2", unitPrice: 649, image: "/images/lego.png", quantity: 1 },
    ],
    subtotal: 2447,
    shipping: 299,
    total: 2746,
    paymentBrand: "visa",
    paymentLast4: "4242",
  payment: { provider: "STRIPE", methodType: null, installments: null, ticketUrl: null, ticketExpiresAt: null },
    createdAt: "2026-10-17T15:00:00.000Z",
    submittedAt: null,
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    hasAccount: false,
    ...overrides,
  };
}
