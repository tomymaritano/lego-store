import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import { signMercadoPagoNotification } from "../../src/lib/payments/mercadopago/signature";
import { latestOrder } from "./db";
import { E2E_MERCADOPAGO_SECRET } from "./stripe";

/*
 * Mercado Pago in the e2e suite. The dev server runs its in-memory mock
 * (PAYMENTS_MOCK=1, helpers/stripe.ts E2E_SERVER_ENV). What Mercado Pago
 * would do later on its own (a cash ticket paid at the counter), the spec
 * does through the mock's test route (/api/test/mercadopago, mock mode only);
 * then it sends the notification Mercado Pago would send, signed with the
 * test secret, through the real webhook route, which reads the payment back.
 */

/** Mercado Pago changes the status of the newest order's payment (e.g. the customer paid the ticket). */
export async function setLatestPaymentStatus(request: APIRequestContext, email: string, status: string, statusDetail: string | null) {
  const order = await latestOrder(email);
  expect(order?.providerPaymentId, `no Mercado Pago payment for ${email}`).toBeTruthy();
  const response = await request.post("/api/test/mercadopago", {
    data: { action: "set_status", paymentId: order!.providerPaymentId, status, statusDetail },
  });
  expect(response.status()).toBe(200);
  return order!;
}

/** The signed notification Mercado Pago sends about a payment; returns the webhook's result. */
export async function notifyPayment(request: APIRequestContext, paymentId: string) {
  const requestId = `e2e-${randomUUID()}`;
  const signature = signMercadoPagoNotification({ dataId: paymentId, requestId }, E2E_MERCADOPAGO_SECRET);
  const response = await request.post(`/api/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {
    data: JSON.stringify({ type: "payment", action: "payment.updated", data: { id: paymentId } }),
    headers: { "content-type": "application/json", "x-signature": signature, "x-request-id": requestId },
  });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { result: string }).result;
}

/** The customer pays a Checkout Pro preference on Mercado Pago (the mock); returns the new payment's id. */
export async function payPreference(request: APIRequestContext, preferenceId: string): Promise<string> {
  const response = await request.post("/api/test/mercadopago", { data: { action: "pay_preference", preferenceId } });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { payment: { id: string } }).payment.id;
}
