/**
 * Shared ids for the product page. Plain module (no "use client") so Server
 * Components can read the values: a constant exported from a client module
 * reaches the server as a client reference, not as the string.
 */

/** Fragment that opens the reviews tab and moves focus to the reviews heading. */
export const REVIEWS_HASH = "resenas";

/** Fragment that opens the reviews tab with the review form open and focused. */
export const WRITE_REVIEW_HASH = "escribir-resena";
