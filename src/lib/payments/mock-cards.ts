/**
 * Test cards of the mock payment mode (STRIPE_MOCK=1, never in production):
 * the mock payment step offers these instead of Stripe's Payment Element, and
 * the mock gateway (./mock.ts) reads the ConfirmationToken
 * "ctoken_mock_<id>" back. Same numbers as Stripe's own test cards.
 * Client-safe: no server code here.
 */
export const MOCK_CARDS = {
  visa: { label: "Visa aprobada", number: "4242 4242 4242 4242", brand: "visa", last4: "4242", decline: null },
  mastercard: { label: "Mastercard aprobada", number: "5555 5555 5555 4444", brand: "mastercard", last4: "4444", decline: null },
  declined: { label: "Visa rechazada", number: "4000 0000 0000 0002", brand: "visa", last4: "0002", decline: "generic_decline" },
  insufficient: {
    label: "Visa sin fondos",
    number: "4000 0000 0000 9995",
    brand: "visa",
    last4: "9995",
    decline: "insufficient_funds",
  },
} as const;

export type MockCardId = keyof typeof MOCK_CARDS;

export const MOCK_TOKEN_PREFIX = "ctoken_mock_";

export const mockTokenId = (card: MockCardId) => `${MOCK_TOKEN_PREFIX}${card}`;
