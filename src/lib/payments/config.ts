import "server-only";

import type { PaymentGateway } from "./gateway";
import { createMockState, mockGateway, type MockGatewayState } from "./mock";
import { createStripeClient, stripeGateway } from "./stripe";

/*
 * Which payment provider the app uses, from the environment:
 *
 *   stripe        STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY +
 *                 STRIPE_WEBHOOK_SECRET (test or live keys; nothing else changes)
 *   mock          STRIPE_MOCK=1 and NODE_ENV is not "production": the in-memory
 *                 gateway (./mock.ts) for the e2e suite. Webhooks still need
 *                 STRIPE_WEBHOOK_SECRET; the tests sign their events with it.
 *   unconfigured  anything else: checkout says payments are not configured.
 *
 * The mock can never run in production: NODE_ENV=production ignores the flag,
 * and so does a production build (`next build`), whatever NODE_ENV the server
 * is later started with: Next inlines process.env.NODE_ENV into the bundle.
 */

export type PaymentsMode = "stripe" | "mock" | "unconfigured";

type Env = Record<string, string | undefined>;

const set = (value: string | undefined) => Boolean(value?.trim());

/**
 * True in a bundle built by `next build`. Written as the literal
 * process.env.NODE_ENV on purpose: Next replaces it at build time, so starting
 * a production build with NODE_ENV=test cannot turn it back into a dev server.
 */
const PRODUCTION_BUILD = process.env.NODE_ENV === "production";

export function isMockAllowed(env: Env = process.env, productionBuild = PRODUCTION_BUILD): boolean {
  return env.STRIPE_MOCK === "1" && env.NODE_ENV !== "production" && !productionBuild;
}

/** The startup warning for a server that takes payments through the mock (nothing is charged). */
export function mockPaymentsWarning(env: Env = process.env): string | null {
  if (!isMockAllowed(env)) return null;
  return (
    "[payments] STRIPE_MOCK=1: los pagos pasan por la pasarela simulada y no se cobra nada. " +
    "Solo para desarrollo y los tests e2e; nunca en un servidor público."
  );
}

/** The Stripe variables that are missing (empty when Stripe is fully configured). */
export function missingStripeVariables(env: Env = process.env): string[] {
  return ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"].filter((name) => !set(env[name]));
}

export function paymentsMode(env: Env = process.env): PaymentsMode {
  if (isMockAllowed(env)) return "mock";
  return missingStripeVariables(env).length === 0 ? "stripe" : "unconfigured";
}

/** The webhook signing secret, or null when webhooks are not configured. */
export function webhookSecret(env: Env = process.env): string | null {
  return set(env.STRIPE_WEBHOOK_SECRET) ? env.STRIPE_WEBHOOK_SECRET!.trim() : null;
}

/** What the browser needs to render the payment step. */
export interface PaymentsClientConfig {
  mode: PaymentsMode;
  publishableKey: string | null;
  /** Development only: which variables to set (never sent in production). */
  missing: string[];
}

export function paymentsClientConfig(env: Env = process.env): PaymentsClientConfig {
  const mode = paymentsMode(env);
  return {
    mode,
    publishableKey: mode === "stripe" ? env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!.trim() : null,
    missing: mode === "unconfigured" && env.NODE_ENV !== "production" ? missingStripeVariables(env) : [],
  };
}

const globalForPayments = globalThis as unknown as {
  mockPayments?: { state: MockGatewayState; gateway: PaymentGateway };
  stripeGateway?: PaymentGateway;
};

/** The app's gateway, or null when payments are not configured. */
export function getPaymentGateway(env: Env = process.env): PaymentGateway | null {
  switch (paymentsMode(env)) {
    case "mock":
      // One state per server process, kept across hot reloads like the Prisma client.
      if (!globalForPayments.mockPayments) {
        const state = createMockState();
        globalForPayments.mockPayments = { state, gateway: mockGateway(state) };
      }
      return globalForPayments.mockPayments.gateway;
    case "stripe":
      globalForPayments.stripeGateway ??= stripeGateway(createStripeClient(env.STRIPE_SECRET_KEY!.trim()));
      return globalForPayments.stripeGateway;
    default:
      return null;
  }
}
