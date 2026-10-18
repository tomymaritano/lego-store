import "server-only";

import { signPayload, verifyPayload } from "@/lib/auth/signing";

/*
 * Re-checks of an applied coupon (the cart and the checkout asking again when
 * they load) have a roomier rate limit than codes being tried
 * (rateLimits.couponRecheck vs couponQuote). To keep that budget from being
 * a way to guess codes, it is only for a code the server already accepted:
 * every accepted quote carries a token signed for its code, the browser
 * sends it back with its re-checks, and a re-check without a valid one
 * counts as a try. A token proves nothing but "this code existed when it was
 * applied": the re-check validates the coupon in full as always.
 */

const PURPOSE = "coupon-recheck";

/** The token for an accepted `code` (normalised); null without AUTH_SECRET (then every quote counts as a try). */
export const couponRecheckToken = (code: string): string | null => signPayload(PURPOSE, code);

/** Whether `token` is the one couponRecheckToken() made for `code`. */
export const isCouponRecheckToken = (code: string, token: unknown): boolean => verifyPayload(PURPOSE, code, token);
