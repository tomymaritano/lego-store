/**
 * Test payment options of the mock mode (PAYMENTS_MOCK=1, never in
 * production): the mock payment step offers these instead of the Payment
 * Brick, and the mock client (./mock.ts) reads the card token
 * "mp_mock_<id>" back. The outcomes follow Mercado Pago's test cardholder
 * names (APRO, CONT, FUND, OTHE) and its cash methods. Client-safe.
 */
export const MP_MOCK_CARDS = {
  approved: {
    label: "Visa aprobada",
    number: "4509 9535 6623 3704",
    paymentMethodId: "visa",
    paymentTypeId: "credit_card",
    last4: "3704",
    installments: 1,
    status: "approved",
    detail: "accredited",
  },
  installments: {
    label: "Mastercard aprobada en 3 cuotas",
    number: "5031 7557 3453 0604",
    paymentMethodId: "master",
    paymentTypeId: "credit_card",
    last4: "0604",
    installments: 3,
    status: "approved",
    detail: "accredited",
  },
  review: {
    label: "Visa en revisión",
    number: "4509 9535 6623 3704",
    paymentMethodId: "visa",
    paymentTypeId: "credit_card",
    last4: "3704",
    installments: 1,
    status: "in_process",
    detail: "pending_contingency",
  },
  insufficient: {
    label: "Mastercard sin fondos",
    number: "5031 7557 3453 0604",
    paymentMethodId: "master",
    paymentTypeId: "credit_card",
    last4: "0604",
    installments: 1,
    status: "rejected",
    detail: "cc_rejected_insufficient_amount",
  },
  rejected: {
    label: "Visa rechazada",
    number: "4509 9535 6623 3704",
    paymentMethodId: "visa",
    paymentTypeId: "credit_card",
    last4: "3704",
    installments: 1,
    status: "rejected",
    detail: "cc_rejected_other_reason",
  },
} as const;

export type MpMockCardId = keyof typeof MP_MOCK_CARDS;

/** Cash methods: the payment is created pending, with a ticket to pay. */
export const MP_MOCK_TICKETS = {
  rapipago: { label: "Rapipago (efectivo)" },
  pagofacil: { label: "Pago Fácil (efectivo)" },
} as const;

export type MpMockTicketId = keyof typeof MP_MOCK_TICKETS;

export const MP_MOCK_TOKEN_PREFIX = "mp_mock_";

export const mpMockToken = (card: MpMockCardId) => `${MP_MOCK_TOKEN_PREFIX}${card}`;

export function mpMockCardOf(token: string | undefined): (typeof MP_MOCK_CARDS)[MpMockCardId] | null {
  if (!token?.startsWith(MP_MOCK_TOKEN_PREFIX)) return null;
  const id = token.slice(MP_MOCK_TOKEN_PREFIX.length);
  return Object.hasOwn(MP_MOCK_CARDS, id) ? MP_MOCK_CARDS[id as MpMockCardId] : null;
}
