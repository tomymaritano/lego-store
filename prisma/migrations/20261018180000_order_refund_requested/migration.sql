-- An admin's cancellation of a paid order records that it asked Stripe for
-- the refund before asking, so an order whose refund outcome is unknown
-- (no answer from Stripe) cannot be shipped until it is reconciled.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "refundRequestedAt" TIMESTAMP(3);
