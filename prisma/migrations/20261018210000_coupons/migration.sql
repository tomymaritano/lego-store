-- Coupons: percent or fixed discounts on an order's products, with a minimum
-- subtotal, dates, a total and a per-customer limit (src/lib/coupons). The
-- order keeps the code and the discount as a snapshot; CouponRedemption is
-- each order's use of a coupon: RESERVED while the order waits to be paid,
-- REDEEMED once paid, RELEASED when it is cancelled (a trigger, below).
-- AuditLog is the admin's audit trail for everything but order status
-- changes (those keep OrderStatusChange).

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('ALL');

-- CreateEnum
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxPerUser" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "appliesTo" "CouponScope" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "discount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_createdAt_idx" ON "Coupon"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId", "status");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_email_idx" ON "CouponRedemption"("couponId", "email");

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written (see the first migration).

-- An order's total now takes the coupon's discount off the products (never
-- more than their subtotal); shipping is never discounted.
ALTER TABLE "Order" DROP CONSTRAINT "Order_total_adds_up";
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_total_adds_up" CHECK ("total" = "subtotal" - "discount" + "shipping"),
  ADD CONSTRAINT "Order_discount_range" CHECK ("discount" >= 0 AND "discount" <= "subtotal"),
  ADD CONSTRAINT "Order_discount_has_coupon" CHECK ("discount" = 0 OR "couponCode" IS NOT NULL);

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_code_format" CHECK ("code" = upper("code") AND "code" ~ '^[A-Z0-9_-]{3,32}$'),
  ADD CONSTRAINT "Coupon_value_positive" CHECK ("value" > 0),
  ADD CONSTRAINT "Coupon_percent_range" CHECK ("type" <> 'PERCENT' OR "value" <= 100),
  ADD CONSTRAINT "Coupon_minSubtotal_nonnegative" CHECK ("minSubtotal" >= 0),
  ADD CONSTRAINT "Coupon_maxRedemptions_positive" CHECK ("maxRedemptions" IS NULL OR "maxRedemptions" > 0),
  ADD CONSTRAINT "Coupon_maxPerUser_positive" CHECK ("maxPerUser" IS NULL OR "maxPerUser" > 0),
  ADD CONSTRAINT "Coupon_dates_ordered" CHECK ("startsAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" > "startsAt");

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_discount_nonnegative" CHECK ("discount" >= 0),
  ADD CONSTRAINT "CouponRedemption_email_lowercase" CHECK ("email" = lower("email"));

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorEmail_lowercase" CHECK ("actorEmail" = lower("actorEmail"));

-- A coupon's use follows its order: every path that pays an order (the Stripe
-- and Mercado Pago webhooks, the checkout's own answer, the cleanup) or
-- cancels it (expiry, a replaced checkout, a rejected or refunded payment, a
-- chargeback, the admin) changes Order.status, so the use is redeemed or
-- released here, in the same transaction, and no path can forget it.
-- PAYMENT_PENDING keeps the reservation; SHIPPED and DELIVERED come after PAID.
CREATE FUNCTION "coupon_redemption_follows_order"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'CANCELLED' THEN
    UPDATE "CouponRedemption"
      SET "status" = 'RELEASED', "releasedAt" = now(), "updatedAt" = now()
      WHERE "orderId" = NEW."id" AND "status" <> 'RELEASED';
  ELSIF NEW."status" = 'PAID' THEN
    UPDATE "CouponRedemption"
      SET "status" = 'REDEEMED', "redeemedAt" = COALESCE("redeemedAt", now()), "releasedAt" = NULL, "updatedAt" = now()
      WHERE "orderId" = NEW."id" AND "status" <> 'REDEEMED';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_coupon_redemption_status"
  AFTER UPDATE OF "status" ON "Order"
  FOR EACH ROW
  WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION "coupon_redemption_follows_order"();
