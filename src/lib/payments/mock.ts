import { randomBytes } from "node:crypto";
import {
  PaymentDeclinedError,
  declineMessage,
  REUSABLE_INTENT_STATUSES,
  type CardPreview,
  type GatewayIntent,
  type PaymentGateway,
} from "./gateway";
import { MOCK_CARDS, MOCK_TOKEN_PREFIX, type MockCardId } from "./mock-cards";

/*
 * An in-memory PaymentGateway: what the e2e suite and the integration tests
 * use instead of Stripe's API (./config.ts only enables it outside production
 * and with STRIPE_MOCK=1). It behaves like Stripe where the order code
 * depends on it: idempotency keys return the first result, only reusable
 * intents take a new amount, a confirmed intent cannot be confirmed again,
 * and refunds are idempotent too. Nothing is sent anywhere: the webhook that
 * Stripe would send after a successful payment is delivered by the test
 * (signed with the test secret, see e2e/helpers/stripe.ts).
 *
 * ConfirmationTokens are "ctoken_mock_<card>" (./mock-cards.ts): the mock
 * payment step in the browser picks one of the test cards.
 */

interface MockIntent extends GatewayIntent {
  orderId: string;
  email: string;
}

export interface MockGatewayState {
  intents: Map<string, MockIntent>;
  /** idempotency key -> result id */
  keys: Map<string, string>;
  refunds: Map<string, { id: string; intentId: string }>;
}

export function createMockState(): MockGatewayState {
  return { intents: new Map(), keys: new Map(), refunds: new Map() };
}

const newId = (prefix: string) => `${prefix}_mock_${randomBytes(9).toString("hex")}`;

function cardOf(tokenId: string): (typeof MOCK_CARDS)[MockCardId] | null {
  if (!tokenId.startsWith(MOCK_TOKEN_PREFIX)) return null;
  const id = tokenId.slice(MOCK_TOKEN_PREFIX.length);
  return Object.hasOwn(MOCK_CARDS, id) ? MOCK_CARDS[id as MockCardId] : null;
}

export function mockGateway(state: MockGatewayState = createMockState()): PaymentGateway {
  const intent = (id: string): MockIntent => {
    const found = state.intents.get(id);
    if (!found) throw new Error(`No such payment_intent: '${id}'`);
    return found;
  };
  const view = ({ id, status, amount, clientSecret }: MockIntent): GatewayIntent => ({ id, status, amount, clientSecret });

  return {
    async createIntent({ orderId, amount, email, idempotencyKey }) {
      const existing = state.keys.get(idempotencyKey);
      if (existing) return view(intent(existing));
      const id = newId("pi");
      const created: MockIntent = { id, status: "requires_payment_method", amount, clientSecret: `${id}_secret`, orderId, email };
      state.intents.set(id, created);
      state.keys.set(idempotencyKey, id);
      return view(created);
    },

    async retrieveIntent(id) {
      return view(intent(id));
    },

    async updateIntentAmount(id, amount) {
      const current = intent(id);
      if (!REUSABLE_INTENT_STATUSES.includes(current.status)) {
        throw new Error(`This PaymentIntent's amount could not be updated because it has a status of ${current.status}.`);
      }
      current.amount = amount;
      return view(current);
    },

    async confirmIntent(id, confirmationTokenId, idempotencyKey) {
      const existing = state.keys.get(idempotencyKey);
      if (existing === id) return view(intent(id));
      const current = intent(id);
      if (!REUSABLE_INTENT_STATUSES.includes(current.status)) {
        throw new Error(`This PaymentIntent's status is ${current.status}; it cannot be confirmed.`);
      }
      const card = cardOf(confirmationTokenId);
      if (!card) throw new PaymentDeclinedError("Vuelve a ingresar los datos de la tarjeta.", "payment_method_invalid");
      state.keys.set(idempotencyKey, id);
      if (card.decline) {
        current.status = "requires_payment_method";
        throw new PaymentDeclinedError(declineMessage(card.decline), "declined");
      }
      current.status = "succeeded";
      return view(current);
    },

    async cancelIntent(id) {
      const current = intent(id);
      if (current.status === "succeeded") throw new Error("You cannot cancel this PaymentIntent because it has a status of succeeded.");
      current.status = "canceled";
      return view(current);
    },

    async refund(intentId, idempotencyKey) {
      const existing = state.keys.get(idempotencyKey);
      if (existing && state.refunds.has(existing)) return { id: existing };
      if (intent(intentId).status !== "succeeded") throw new Error("This PaymentIntent has no successful charge to refund.");
      const id = newId("re");
      state.refunds.set(id, { id, intentId });
      state.keys.set(idempotencyKey, id);
      return { id };
    },

    async findRefund(intentId) {
      intent(intentId);
      const found = [...state.refunds.values()].find((refund) => refund.intentId === intentId);
      return found ? { id: found.id } : null;
    },

    async readConfirmationToken(id): Promise<CardPreview | null> {
      const card = cardOf(id);
      return card ? { brand: card.brand, last4: card.last4 } : null;
    },
  };
}
