import { z } from "zod";

/** A database id from the client (product, review): a non-empty, short string. Unknown ids fail later, as not found. */
export const idSchema = z.string().trim().min(1).max(64);

export const productIdSchema = idSchema;
export const reviewIdSchema = idSchema;

/**
 * The ?ids= of GET /api/products/by-ids: comma lists and repeated params, each
 * a product id. Generous bound on the count (the persisted lists can hold more
 * than one request resolves; the server reads the first MAX_IDS_PER_REQUEST).
 */
export const productIdListSchema = z.array(productIdSchema).max(500);
