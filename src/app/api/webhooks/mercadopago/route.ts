import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { applyMercadoPagoPayment, type ApplyOutcome } from "@/lib/orders/mercadopago";
import { afterMercadoPagoPayment } from "@/lib/orders/payment-effects";
import { getMercadoPago, mercadoPagoWebhookSecret } from "@/lib/payments/config";
import { mercadoPagoProvider } from "@/lib/payments/mercadopago/provider";

/**
 * POST /api/webhooks/mercadopago: Mercado Pago's notifications about payments
 * (Webhooks, topic "payment"; set this URL in Tus integraciones > Webhooks,
 * or it goes in each payment's notification_url).
 *
 * The x-signature header is verified first (HMAC-SHA256 with
 * MERCADOPAGO_WEBHOOK_SECRET over "id:<data.id>;request-id:<x-request-id>;ts:<ts>;",
 * lib/payments/mercadopago/signature.ts). The body is never trusted: the
 * payment is read from Mercado Pago's API, and lib/orders/mercadopago.ts
 * applies its current status at most once (retries, repeats and late
 * notifications change nothing twice). Then the catalogue and the customer
 * hear about it (lib/orders/payment-effects.ts).
 *
 * 200 handled (or about something else / already handled) · 401 bad
 * signature · 500 the work failed: Mercado Pago retries · 503 not configured.
 */
export async function POST(request: NextRequest) {
  const secret = mercadoPagoWebhookSecret();
  const mp = getMercadoPago();
  if (!secret || !mp) return Response.json({ error: "Webhooks de Mercado Pago no configurados." }, { status: 503 });

  const body = await request.text();
  let events;
  try {
    events = await mercadoPagoProvider(mp, secret).parseWebhook({ body, url: request.nextUrl, headers: request.headers });
  } catch (error) {
    // The payment could not be read from the API: Mercado Pago retries the notification.
    console.error("[mercadopago] No se pudo leer el pago de la notificación:", error);
    return Response.json({ error: "No se pudo procesar la notificación." }, { status: 500 });
  }
  if (!events) {
    console.warn(`[mercadopago] Notificación con firma inválida (x-request-id ${request.headers.get("x-request-id") ?? "?"}).`);
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }

  const db = getDb();
  let outcome: ApplyOutcome = { result: "ignored" };
  for (const event of events) {
    try {
      outcome = await applyMercadoPagoPayment(db, mp, event.raw, "webhook");
    } catch (error) {
      console.error(`[mercadopago] No se pudo aplicar el pago ${event.paymentId} (${event.providerStatus}):`, error);
      return Response.json({ error: "No se pudo procesar la notificación." }, { status: 500 });
    }
    await afterMercadoPagoPayment(db, outcome);
  }
  return Response.json({ received: true, result: outcome.result });
}
