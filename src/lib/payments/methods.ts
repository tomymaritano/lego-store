import type { PaymentProviderId } from "@/lib/orders/types";

/**
 * What each payment provider lets a customer pay with, as the footer's
 * "Medios de pago" badges show it (the store's provider is PAYMENT_PROVIDER,
 * src/lib/payments/config.ts). Mercado Pago's Payment Brick takes cards in
 * instalments, debit cards, account money and cash; the Stripe Payment
 * Element, as set up here, takes cards.
 */
export const PAYMENT_METHOD_BADGES: Record<PaymentProviderId, readonly string[]> = {
  MERCADOPAGO: ["Mercado Pago", "Tarjetas de crédito", "Tarjetas de débito", "Efectivo"],
  STRIPE: ["Visa", "Mastercard", "American Express"],
};
