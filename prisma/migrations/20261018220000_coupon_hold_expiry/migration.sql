-- Coupon holds lapse: "Revisar" reserves a coupon's use for a short while
-- (src/lib/coupons/server.ts COUPON_HOLD_MS) instead of for as long as the
-- unpaid order exists, so checkouts that are never paid cannot keep a
-- coupon's uses (or a customer's) taken. Submitting the payment makes the
-- hold last until the order settles (holdExpiresAt NULL). Existing
-- reservations keep holding (NULL), as they did.

-- AlterTable
ALTER TABLE "CouponRedemption" ADD COLUMN     "holdExpiresAt" TIMESTAMP(3);

-- Hand-written (see the first migration).

-- An order waiting on a payment Mercado Pago already has (a cash ticket, a
-- card under review, a Checkout Pro payment in process) holds its coupon
-- until that payment settles; PAID and CANCELLED settle the use as before.
CREATE OR REPLACE FUNCTION "coupon_redemption_follows_order"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'CANCELLED' THEN
    UPDATE "CouponRedemption"
      SET "status" = 'RELEASED', "releasedAt" = now(), "holdExpiresAt" = NULL, "updatedAt" = now()
      WHERE "orderId" = NEW."id" AND "status" <> 'RELEASED';
  ELSIF NEW."status" = 'PAID' THEN
    UPDATE "CouponRedemption"
      SET "status" = 'REDEEMED', "redeemedAt" = COALESCE("redeemedAt", now()), "releasedAt" = NULL, "holdExpiresAt" = NULL, "updatedAt" = now()
      WHERE "orderId" = NEW."id" AND "status" <> 'REDEEMED';
  ELSIF NEW."status" = 'PAYMENT_PENDING' THEN
    UPDATE "CouponRedemption"
      SET "holdExpiresAt" = NULL, "updatedAt" = now()
      WHERE "orderId" = NEW."id" AND "status" = 'RESERVED' AND "holdExpiresAt" IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
