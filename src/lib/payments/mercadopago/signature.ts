import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Mercado Pago's webhook signature (Tus integraciones > Webhooks > "Clave
 * secreta"; https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks).
 *
 * The x-signature header is "ts=<unix seconds>,v1=<hex>", where v1 is the
 * HMAC-SHA256, keyed with the secret, of the manifest
 *
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * data.id comes from the notification URL's query string (lowercased when it
 * is alphanumeric), x-request-id from its header; a part whose value is
 * missing is left out of the manifest. The official SDK's
 * WebhookSignatureValidator computes the same (the unit tests check both
 * agree). The check is constant-time.
 *
 * No timestamp window by default: Mercado Pago retries a notification for
 * hours, and replaying one is harmless here (the webhook reads the payment
 * from the API and applies each status once).
 */

export interface SignatureParts {
  /** data.id from the notification URL's query string. */
  dataId: string | null;
  /** The x-request-id header. */
  requestId: string | null;
  /** Unix seconds (the ts in x-signature). */
  ts: string;
}

const present = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

/** data.id as signed: lowercased (Mercado Pago lowercases alphanumeric ids before signing). */
const signedId = (dataId: string | null) => {
  const id = present(dataId);
  return id ? id.toLowerCase() : null;
};

export function signatureManifest({ dataId, requestId, ts }: SignatureParts): string {
  const id = signedId(dataId);
  const request = present(requestId);
  return `${id ? `id:${id};` : ""}${request ? `request-id:${request};` : ""}ts:${ts};`;
}

/** Parses "ts=…,v1=…"; null when it is not that. */
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  return ts && /^\d+$/.test(ts) && v1 && /^[0-9a-f]+$/i.test(v1) ? { ts, v1: v1.toLowerCase() } : null;
}

export function signManifest(manifest: string, secret: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

/**
 * Whether a notification's x-signature was made with `secret`. With
 * `toleranceSeconds`, its ts must also be that close to `now`.
 */
export function verifyMercadoPagoSignature(
  input: { signature: string | null; requestId: string | null; dataId: string | null },
  secret: string,
  { toleranceSeconds, now = Date.now() }: { toleranceSeconds?: number; now?: number } = {}
): boolean {
  const parsed = parseSignatureHeader(input.signature);
  if (!parsed || !secret) return false;
  const expected = Buffer.from(signManifest(signatureManifest({ dataId: input.dataId, requestId: input.requestId, ts: parsed.ts }), secret));
  const received = Buffer.from(parsed.v1);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  return toleranceSeconds === undefined || Math.abs(now / 1000 - Number(parsed.ts)) <= toleranceSeconds;
}

/**
 * The x-signature header Mercado Pago would send (tests and the e2e suite
 * sign their notifications with the test secret, as Mercado Pago does).
 */
export function signMercadoPagoNotification(
  { dataId, requestId, ts = String(Math.floor(Date.now() / 1000)) }: { dataId: string | null; requestId: string | null; ts?: string },
  secret: string
): string {
  return `ts=${ts},v1=${signManifest(signatureManifest({ dataId, requestId, ts }), secret)}`;
}
