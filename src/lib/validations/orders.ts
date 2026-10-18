import { z } from "zod";
import { shippingSchema } from "./checkout";
import { couponCodeSchema } from "./coupon-code";
import { idSchema, productIdSchema } from "./ids";

/*
 * Inputs of the checkout Route Handlers (src/app/api/checkout). Only ids,
 * quantities, the shipping form, the coupon code and the ConfirmationToken id cross the wire:
 * prices, totals and stock always come from the database, and card data
 * never reaches us (Stripe.js turns it into the token in the browser).
 */

/** Most distinct products one order takes. */
export const MAX_ORDER_LINES = 50;
/** Most units of one product per order. */
export const MAX_ORDER_LINE_QUANTITY = 99;

/** A Stripe ConfirmationToken id ("ctoken_…"). */
export const confirmationTokenIdSchema = z.string().regex(/^ctoken_[A-Za-z0-9_]{1,250}$/);

export const orderLineInputSchema = z.object({
  productId: productIdSchema,
  quantity: z.number().int().min(1).max(MAX_ORDER_LINE_QUANTITY),
});

/** POST /api/checkout/orders: create or update this browser's pending order. */
export const prepareOrderSchema = z.object({
  shipping: shippingSchema,
  lines: z
    .array(orderLineInputSchema)
    .min(1)
    .max(MAX_ORDER_LINES)
    .refine((lines) => new Set(lines.map((line) => line.productId)).size === lines.length, "Repeated product"),
  confirmationTokenId: confirmationTokenIdSchema,
  /** The coupon applied in the cart or the checkout, if any: validated and reserved on the server. */
  couponCode: couponCodeSchema.optional(),
});

export type PrepareOrderInput = z.infer<typeof prepareOrderSchema>;

/** POST /api/checkout/orders/<id>/pay */
export const payOrderSchema = z.object({ confirmationTokenId: confirmationTokenIdSchema });

export const orderIdSchema = idSchema;

// ---------------------------------------------------------------------------
// Mercado Pago
// ---------------------------------------------------------------------------

/**
 * POST /api/checkout/orders for a Mercado Pago order: the same lines and
 * shipping, no payment data yet (the Payment Brick's formData only crosses
 * the wire on "Realizar pedido").
 */
export const prepareMercadoPagoOrderSchema = z.object({
  shipping: shippingSchema,
  lines: prepareOrderSchema.shape.lines,
  couponCode: prepareOrderSchema.shape.couponCode,
  provider: z.literal("MERCADOPAGO"),
});

export type PrepareMercadoPagoOrderInput = z.infer<typeof prepareMercadoPagoOrderSchema>;

/** How the customer pays with Mercado Pago: a card or cash through the Brick, or their Mercado Pago account (Checkout Pro). */
export const MERCADOPAGO_METHODS = ["card", "ticket", "wallet"] as const;
export type MercadoPagoMethod = (typeof MERCADOPAGO_METHODS)[number];

const digits = (max: number) => z.string().regex(new RegExp(String.raw`^[0-9]{1,${max}}$`));

/**
 * The Payment Brick's formData, as much of it as the server uses. The card is
 * a single-use token (never card data); the amount the browser sends is
 * ignored: the server charges the order's total.
 */
export const mercadoPagoFormDataSchema = z.object({
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,128}$/)
    .optional(),
  payment_method_id: z.string().regex(/^[a-z0-9_]{2,40}$/),
  /** The card's issuer; the Brick sends it as a string of digits. */
  issuer_id: z.coerce.number().int().positive().max(999_999_999_999).optional(),
  installments: z.number().int().min(1).max(72).optional(),
  payer: z
    .object({
      email: z.email().max(254).optional(),
      first_name: z.string().trim().max(80).optional(),
      last_name: z.string().trim().max(80).optional(),
      identification: z
        .object({
          type: z.string().regex(/^[A-Za-z]{2,10}$/),
          number: z.string().regex(/^[0-9A-Za-z.-]{3,20}$/),
        })
        .optional(),
    })
    .optional(),
});

export type MercadoPagoFormData = z.infer<typeof mercadoPagoFormDataSchema>;

/** POST /api/checkout/orders/<id>/pay for a Mercado Pago order. */
export const payMercadoPagoOrderSchema = z.object({
  mercadopago: z
    .object({
      /** Made by the browser when the payment step is submitted: a retried "Realizar pedido" is the same payment. */
      attemptId: z.uuid(),
      method: z.enum(MERCADOPAGO_METHODS),
      formData: mercadoPagoFormDataSchema.optional(),
    })
    .refine(
      (payment) =>
        payment.method === "wallet" ? payment.formData === undefined : payment.method === "card" ? Boolean(payment.formData?.token) : Boolean(payment.formData),
      "Missing payment data"
    ),
});

export type PayMercadoPagoOrderInput = z.infer<typeof payMercadoPagoOrderSchema>["mercadopago"];

/** POST /api/checkout/orders/<id>/sync: back from Mercado Pago, with the payment it reported (optional). */
export const syncOrderSchema = z.object({ paymentId: digits(20).optional() });
