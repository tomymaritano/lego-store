import { z } from "zod";
import { productIdSchema } from "./ids";

/*
 * Inputs of the cart and wishlist Server Actions (src/lib/lists/actions.ts).
 * Only ids and quantities cross the wire: names, prices and stock always come
 * from the database.
 */

/** Most lines a merge (or a cart) takes; a real cart is far smaller. */
export const MAX_LIST_ITEMS = 200;
/** Most units of one product a cart line asks for (the stock caps it further). */
export const MAX_LINE_QUANTITY = 999;


export const quantitySchema = z.number().int().min(1).max(MAX_LINE_QUANTITY);

export const cartLineInputSchema = z.object({ productId: productIdSchema, quantity: quantitySchema });

export type CartLineInput = z.infer<typeof cartLineInputSchema>;

/** The browser's random id for one merge of its guest lists (see src/lib/lists/merge.ts). */
export const mergeTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

/** What a browser sends on login: its guest cart and wishlist, and the merge's token. */
export const mergeListsSchema = z.object({
  token: mergeTokenSchema,
  cart: z.array(cartLineInputSchema).max(MAX_LIST_ITEMS),
  wishlist: z.array(productIdSchema).max(MAX_LIST_ITEMS),
});

export type MergeListsInput = z.infer<typeof mergeListsSchema>;
