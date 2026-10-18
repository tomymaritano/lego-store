import { z } from "zod";

/** A database id from the client (product, review): a non-empty, short string. Unknown ids fail later, as not found. */
export const idSchema = z.string().trim().min(1).max(64);

export const productIdSchema = idSchema;
export const reviewIdSchema = idSchema;
