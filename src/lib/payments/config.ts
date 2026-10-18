import "server-only";

import type { PaymentProviderId } from "@/lib/orders/types";
import type { PaymentGateway } from "./gateway";
import { createMockState, mockGateway, type MockGatewayState } from "./mock";
import { createMercadoPagoClient } from "./mercadopago/api";
import { createMockMercadoPagoState, mockMercadoPago, mockMercadoPagoControls, type MockMercadoPagoState } from "./mercadopago/mock";
import type { MercadoPagoClient } from "./mercadopago/types";
import { createStripeClient, stripeGateway } from "./stripe";

/*
 * Which payment providers the app can use, from the environment.
 *
 * New orders go to PAYMENT_PROVIDER: "mercadopago" (the default) or
 * "stripe". An order keeps its provider afterwards, so each provider whose
 * variables are set stays usable (a Stripe order placed before switching can
 * still be refunded). Each provider is in one of three modes:
 *
 *   configured    Mercado Pago: MERCADOPAGO_ACCESS_TOKEN +
 *                 NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY + MERCADOPAGO_WEBHOOK_SECRET.
 *                 Stripe: STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY +
 *                 STRIPE_WEBHOOK_SECRET. Test or production credentials; nothing
 *                 else changes.
 *   mock          PAYMENTS_MOCK=1 (or the older STRIPE_MOCK=1) and NODE_ENV is
 *                 not "production": in-memory stand-ins for both providers
 *                 (./mock.ts, ./mercadopago/mock.ts) for the tests and the e2e
 *                 suite. Webhooks still need each provider's webhook secret; the
 *                 tests sign their notifications with it.
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
  return (env.PAYMENTS_MOCK === "1" || env.STRIPE_MOCK === "1") && env.NODE_ENV !== "production" && !productionBuild;
}

/** The startup warning for a server that takes payments through the mock (nothing is charged). */
export function mockPaymentsWarning(env: Env = process.env): string | null {
  if (!isMockAllowed(env)) return null;
  return (
    "[payments] PAYMENTS_MOCK=1: los pagos pasan por pasarelas simuladas y no se cobra nada. " +
    "Solo para desarrollo y los tests e2e; nunca en un servidor público."
  );
}

// ---------------------------------------------------------------------------
// Which provider takes new orders
// ---------------------------------------------------------------------------

/**
 * Mock mode only (tests, never production): a cookie with this name picks the
 * provider of new orders for that browser ("STRIPE" | "MERCADOPAGO"), so one
 * e2e dev server runs both the Mercado Pago and the Stripe checkout. Ignored
 * wherever the mock is not allowed.
 */
export const MOCK_PROVIDER_COOKIE = "payments-mock-provider";

const warned = new Set<string>();

/** PAYMENT_PROVIDER: "mercadopago" (default) or "stripe"; anything else counts as Mercado Pago, with a warning. */
export function configuredProvider(env: Env = process.env): PaymentProviderId {
  const value = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!value || value === "mercadopago") return "MERCADOPAGO";
  if (value === "stripe") return "STRIPE";
  if (!warned.has(value)) {
    warned.add(value);
    console.warn(`[payments] PAYMENT_PROVIDER="${env.PAYMENT_PROVIDER}" no es "mercadopago" ni "stripe": se usa Mercado Pago.`);
  }
  return "MERCADOPAGO";
}

/** The provider of a new order: PAYMENT_PROVIDER, or the mock-only cookie override. */
export function checkoutProvider(env: Env = process.env, mockOverride?: string | null): PaymentProviderId {
  if (isMockAllowed(env) && (mockOverride === "STRIPE" || mockOverride === "MERCADOPAGO")) return mockOverride;
  return configuredProvider(env);
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

/** The Stripe variables that are missing (empty when Stripe is fully configured). */
export function missingStripeVariables(env: Env = process.env): string[] {
  return ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"].filter((name) => !set(env[name]));
}

/** Stripe's mode. */
export function paymentsMode(env: Env = process.env): PaymentsMode {
  if (isMockAllowed(env)) return "mock";
  return missingStripeVariables(env).length === 0 ? "stripe" : "unconfigured";
}

/** Stripe's webhook signing secret, or null when its webhooks are not configured. */
export function webhookSecret(env: Env = process.env): string | null {
  return set(env.STRIPE_WEBHOOK_SECRET) ? env.STRIPE_WEBHOOK_SECRET!.trim() : null;
}

/** What the browser needs to render Stripe's payment step. */
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

// ---------------------------------------------------------------------------
// Mercado Pago
// ---------------------------------------------------------------------------

export type MercadoPagoMode = "mercadopago" | "mock" | "unconfigured";

/** The Mercado Pago variables that are missing (empty when it is fully configured). */
export function missingMercadoPagoVariables(env: Env = process.env): string[] {
  return ["MERCADOPAGO_ACCESS_TOKEN", "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET"].filter((name) => !set(env[name]));
}

export function mercadoPagoMode(env: Env = process.env): MercadoPagoMode {
  if (isMockAllowed(env)) return "mock";
  return missingMercadoPagoVariables(env).length === 0 ? "mercadopago" : "unconfigured";
}

/** Mercado Pago's webhook secret ("Clave secreta"), or null when its notifications are not configured. */
export function mercadoPagoWebhookSecret(env: Env = process.env): string | null {
  return set(env.MERCADOPAGO_WEBHOOK_SECRET) ? env.MERCADOPAGO_WEBHOOK_SECRET!.trim() : null;
}

export interface MercadoPagoClientConfig {
  mode: MercadoPagoMode;
  publicKey: string | null;
  /** Development only: which variables to set (never sent in production). */
  missing: string[];
}

export function mercadoPagoClientConfig(env: Env = process.env): MercadoPagoClientConfig {
  const mode = mercadoPagoMode(env);
  return {
    mode,
    publicKey: mode === "mercadopago" ? env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY!.trim() : null,
    missing: mode === "unconfigured" && env.NODE_ENV !== "production" ? missingMercadoPagoVariables(env) : [],
  };
}

// ---------------------------------------------------------------------------
// Both
// ---------------------------------------------------------------------------

/** The checkout's payment configuration: who takes the order, and what its payment step needs. */
export type CheckoutPaymentsConfig =
  | { provider: "STRIPE"; mode: PaymentsMode; stripe: PaymentsClientConfig }
  | { provider: "MERCADOPAGO"; mode: MercadoPagoMode; mercadopago: MercadoPagoClientConfig };

export function checkoutPaymentsConfig(env: Env = process.env, mockOverride?: string | null): CheckoutPaymentsConfig {
  if (checkoutProvider(env, mockOverride) === "STRIPE") {
    const stripe = paymentsClientConfig(env);
    return { provider: "STRIPE", mode: stripe.mode, stripe };
  }
  const mercadopago = mercadoPagoClientConfig(env);
  return { provider: "MERCADOPAGO", mode: mercadopago.mode, mercadopago };
}

/** Why the checkout cannot take payments: null when it can (credentials or the test mock). */
export interface PaymentsUnavailable {
  provider: PaymentProviderId;
  /** Development only: which variables to set (empty in production). */
  missing: string[];
}

/**
 * Whether the store's checkout can take payments now: the cart and the
 * checkout's first step say so before the customer types an address, rather
 * than only on the payment step.
 */
export function paymentsUnavailable(env: Env = process.env, mockOverride?: string | null): PaymentsUnavailable | null {
  const config = checkoutPaymentsConfig(env, mockOverride);
  if (config.mode !== "unconfigured") return null;
  return { provider: config.provider, missing: config.provider === "STRIPE" ? config.stripe.missing : config.mercadopago.missing };
}

/** Whether a provider can take payments (and refunds) on this server. */
export function providerConfigured(provider: PaymentProviderId, env: Env = process.env): boolean {
  return provider === "STRIPE" ? paymentsMode(env) !== "unconfigured" : mercadoPagoMode(env) !== "unconfigured";
}

/** How a provider runs here, for the admin: "mock", "test" (sandbox credentials), "live" or "unconfigured". */
export function providerEnvironment(provider: PaymentProviderId, env: Env = process.env): "mock" | "test" | "live" | "unconfigured" {
  const mode = provider === "STRIPE" ? paymentsMode(env) : mercadoPagoMode(env);
  if (mode === "mock" || mode === "unconfigured") return mode;
  const key = provider === "STRIPE" ? env.STRIPE_SECRET_KEY : env.MERCADOPAGO_ACCESS_TOKEN;
  return key?.trim().startsWith(provider === "STRIPE" ? "sk_test_" : "TEST-") ? "test" : "live";
}

const globalForPayments = globalThis as unknown as {
  mockPayments?: { state: MockGatewayState; gateway: PaymentGateway };
  stripeGateway?: PaymentGateway;
  mockMercadoPago?: { state: MockMercadoPagoState; client: MercadoPagoClient };
  mercadoPago?: MercadoPagoClient;
};

/** The app's Stripe gateway, or null when Stripe is not configured. */
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

/** The app's Mercado Pago client, or null when Mercado Pago is not configured. */
export function getMercadoPago(env: Env = process.env): MercadoPagoClient | null {
  switch (mercadoPagoMode(env)) {
    case "mock":
      if (!globalForPayments.mockMercadoPago) {
        const state = createMockMercadoPagoState();
        globalForPayments.mockMercadoPago = { state, client: mockMercadoPago(state) };
      }
      return globalForPayments.mockMercadoPago.client;
    case "mercadopago":
      globalForPayments.mercadoPago ??= createMercadoPagoClient(env.MERCADOPAGO_ACCESS_TOKEN!.trim());
      return globalForPayments.mercadoPago;
    default:
      return null;
  }
}

/** Mock mode only: what Mercado Pago would do on its own (tests, /api/test/mercadopago); null otherwise. */
export function getMercadoPagoMockControls(env: Env = process.env) {
  if (mercadoPagoMode(env) !== "mock") return null;
  getMercadoPago(env);
  return mockMercadoPagoControls(globalForPayments.mockMercadoPago!.state);
}
