import { siteConfig } from "@/config/site";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { mercadoPagoProvider } from "@/lib/payments/mercadopago/provider";
import type { MercadoPagoClient } from "@/lib/payments/mercadopago/types";
import type { PaymentProvider } from "@/lib/payments/provider";
import { stripeProvider } from "@/lib/payments/stripe-provider";
import type { PaymentProviderId } from "./types";

/*
 * The payment clients the order code works with, one per provider (null when
 * that provider is not configured). The app passes its own
 * (src/lib/orders/http.ts, appPayments); tests pass mocks. Functions that
 * predate Mercado Pago also take a bare Stripe gateway, as before: that is
 * "Stripe only".
 */
export interface OrderPayments {
  stripe: PaymentGateway | null;
  mercadopago: MercadoPagoClient | null;
}

const isGateway = (value: object): value is PaymentGateway => "createIntent" in value;

export function asOrderPayments(value: PaymentGateway | OrderPayments | null): OrderPayments {
  if (!value) return { stripe: null, mercadopago: null };
  return isGateway(value) ? { stripe: value, mercadopago: null } : value;
}

/**
 * The provider-neutral view (cancel, refund) of the order's provider, or null
 * when it is not configured: the one place that builds a PaymentProvider for
 * order code. Webhook routes build theirs with the webhook secret (only they
 * verify signatures).
 */
export function providerOf(payments: OrderPayments, provider: PaymentProviderId): PaymentProvider | null {
  if (provider === "STRIPE") return payments.stripe ? stripeProvider(payments.stripe, null) : null;
  return payments.mercadopago ? mercadoPagoProvider(payments.mercadopago, null) : null;
}

/** Absolute URL on this site (NEXT_PUBLIC_SITE_URL): Mercado Pago's return and notification URLs. */
export function publicUrl(path: string, base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url): string {
  return new URL(path, base).toString();
}

/**
 * Mercado Pago's notification_url for our webhook, or null where Mercado Pago
 * could not reach it (http, localhost): local development relies on the
 * return page and the cleanup then (docs/payments.md, "Webhooks en tu máquina").
 */
export function mercadoPagoNotificationUrl(base?: string): string | null {
  const url = new URL(publicUrl("/api/webhooks/mercadopago", base));
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) return null;
  // Only Webhooks (signed), not the older IPN notifications.
  url.searchParams.set("source_news", "webhooks");
  return url.toString();
}
