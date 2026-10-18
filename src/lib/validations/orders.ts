import { z } from "zod";
import { shippingSchema } from "./checkout";
import { idSchema, productIdSchema } from "./ids";

/*
 * Inputs of the checkout Route Handlers (src/app/api/checkout). Only ids,
 * quantities, the shipping form and the ConfirmationToken id cross the wire:
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
});

export type PrepareOrderInput = z.infer<typeof prepareOrderSchema>;

/** POST /api/checkout/orders/<id>/pay */
export const payOrderSchema = z.object({ confirmationTokenId: confirmationTokenIdSchema });

export const orderIdSchema = idSchema;
