import type { NextRequest } from "next/server";
import { invalidateCatalog } from "@/lib/api/cache";
import { getDb } from "@/lib/db";
import { sendOrderCancelled, sendOrderConfirmation } from "@/lib/orders/notify";
import { handleStripeEvent } from "@/lib/orders/webhook";
import { getPaymentGateway, webhookSecret } from "@/lib/payments/config";
import { constructWebhookEvent } from "@/lib/payments/stripe";

/**
 * POST /api/stripe/webhook: Stripe's events about payments.
 *
 * The body is read raw (the signature covers the exact bytes) and verified
 * against STRIPE_WEBHOOK_SECRET before anything else; then
 * lib/orders/webhook.ts applies it at most once. After a payment is taken,
 * the catalogue cache of the products whose stock changed is expired and the
 * confirmation email goes out; after a refund cancels a paid order, the
 * stock that came back is shown again.
 *
 * 200 handled (or ignored / already handled) · 400 bad signature ·
 * 500 the work failed: Stripe retries it · 503 not configured.
 *
 * Local development: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
 */
export async function POST(request: NextRequest) {
  const secret = webhookSecret();
  const gateway = getPaymentGateway();
  if (!secret || !gateway) return Response.json({ error: "Webhooks de Stripe no configurados." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  let event;
  try {
    if (!signature) throw new Error("Missing Stripe-Signature");
    event = constructWebhookEvent(payload, signature, secret);
  } catch (error) {
    console.warn("[stripe] Webhook con firma inválida:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Firma inválida." }, { status: 400 });
  }

  const db = getDb();
  let outcome;
  try {
    outcome = await handleStripeEvent(db, gateway, event);
  } catch (error) {
    console.error(`[stripe] No se pudo procesar ${event.type} (${event.id}):`, error);
    return Response.json({ error: "No se pudo procesar el evento." }, { status: 500 });
  }

  if (outcome.result === "paid") {
    invalidateCatalog({ productIds: outcome.productIds });
    await sendOrderConfirmation(db, outcome.orderId);
  }
  // A refund cancelled a paid order: its stock is back on sale.
  if (outcome.result === "refund_cancelled" && outcome.productIds.length > 0) invalidateCatalog({ productIds: outcome.productIds });
  // The customer was charged and is getting the money back: tell them (a guest has no other way to know).
  if (outcome.result === "refund_cancelled" || outcome.result === "amount_mismatch" || outcome.result === "out_of_stock") {
    await sendOrderCancelled(db, outcome.orderId);
  }
  return Response.json({ received: true, result: outcome.result });
}
