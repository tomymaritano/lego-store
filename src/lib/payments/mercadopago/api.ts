import MercadoPagoConfig, { MercadoPagoError, MPNotFoundError, Payment, PaymentRefund, Preference } from "mercadopago";
import { MercadoPagoRequestError, type MercadoPagoClient, type MpPayment } from "./types";

/*
 * MercadoPagoClient on Mercado Pago's API through the official Node SDK.
 * Test credentials (TEST-… / a test seller's APP_USR-…) and production ones
 * work the same; nothing else changes. Every create carries an idempotency
 * key (X-Idempotency-Key), so a retried request never charges twice.
 */

type PaymentResponse = Awaited<ReturnType<Payment["get"]>>;

type Sdk = { payment: Pick<Payment, "create" | "get" | "cancel">; refund: Pick<PaymentRefund, "create">; preference: Pick<Preference, "create" | "update"> };

/** The SDK's payment in the store's shape. */
export function toMpPayment(payment: PaymentResponse): MpPayment {
  const details = payment.transaction_details as { external_resource_url?: string } | undefined;
  return {
    id: String(payment.id),
    status: payment.status ?? "pending",
    statusDetail: payment.status_detail ?? null,
    externalReference: payment.external_reference ?? null,
    amount: payment.transaction_amount ?? 0,
    currency: payment.currency_id ?? "ARS",
    paymentMethodId: payment.payment_method_id ?? null,
    paymentTypeId: payment.payment_type_id ?? null,
    installments: payment.installments ?? null,
    lastFourDigits: payment.card?.last_four_digits ?? null,
    ticketUrl: details?.external_resource_url ?? null,
    expiresAt: payment.date_of_expiration ?? null,
    refunds: (payment.refunds ?? []).flatMap((refund) =>
      refund.id === undefined ? [] : [{ id: String(refund.id), amount: refund.amount ?? 0, status: refund.status ?? null }]
    ),
  };
}

/** A 4xx from Mercado Pago (other than 404/409/429): the request itself was refused. */
function asRequestError(error: unknown): never {
  if (error instanceof MercadoPagoError && error.status >= 400 && error.status < 500 && ![404, 409, 429].includes(error.status)) {
    throw new MercadoPagoRequestError(error.message, error.status);
  }
  throw error;
}

export function mercadoPagoApi(sdk: Sdk): MercadoPagoClient {
  return {
    async createPayment(request, idempotencyKey) {
      try {
        return toMpPayment(await sdk.payment.create({ body: request, requestOptions: { idempotencyKey } }));
      } catch (error) {
        asRequestError(error);
      }
    },

    async getPayment(id) {
      try {
        return toMpPayment(await sdk.payment.get({ id }));
      } catch (error) {
        if (error instanceof MPNotFoundError || (error instanceof MercadoPagoError && error.status === 404)) return null;
        throw error;
      }
    },

    async cancelPayment(id) {
      return toMpPayment(await sdk.payment.cancel({ id }));
    },

    async refundPayment(id, { idempotencyKey, amount }) {
      const refund = await sdk.refund.create({
        payment_id: id,
        ...(amount === undefined ? {} : { body: { amount } }),
        requestOptions: { idempotencyKey },
      });
      return { id: String(refund.id) };
    },

    async createPreference(request) {
      const preference = await sdk.preference.create({ body: request });
      const initPoint = preference.init_point;
      if (!preference.id || !initPoint) throw new Error("Mercado Pago no devolvió el enlace de pago de la preferencia");
      return { id: preference.id, initPoint };
    },

    async expirePreference(id) {
      // PUT /checkout/preferences/{id} changes only the fields sent (the SDK's type asks for `items`, the API does not).
      const update = { expires: true, expiration_date_to: new Date().toISOString() } as Parameters<Preference["update"]>[0]["updatePreferenceRequest"];
      await sdk.preference.update({ id, updatePreferenceRequest: update });
    },
  };
}

/** The API client for an access token. */
export function createMercadoPagoClient(accessToken: string): MercadoPagoClient {
  const config = new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
  return mercadoPagoApi({ payment: new Payment(config), refund: new PaymentRefund(config), preference: new Preference(config) });
}
