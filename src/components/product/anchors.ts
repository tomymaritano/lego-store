/**
 * Shared ids for the product page. Plain module (no "use client") so Server
 * Components can read the values: a constant exported from a client module
 * reaches the server as a client reference, not as the string.
 */

/** Fragment that opens the reviews tab (the rating under the product title links to it). */
export const REVIEWS_HASH = "resenas";
