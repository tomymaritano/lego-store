-- Mercado Pago as the main payment provider (Stripe stays as the alternative):
-- the order records which provider takes its payment and, for Mercado Pago,
-- the payment of its latest attempt, its method (installments, cash tickets)
-- and status; PAYMENT_PENDING is an order whose payment the provider has not
-- settled yet (a cash ticket, a card under review). PaymentEvent is the
-- history of what the provider said about each payment, unique per
-- payment+status+detail: the idempotency of its notifications.
-- Existing orders are all Stripe's (the column's default).

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MERCADOPAGO');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_PENDING';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "installments" INTEGER,
ADD COLUMN     "paymentMethodType" TEXT,
ADD COLUMN     "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
ADD COLUMN     "paymentStatus" TEXT,
ADD COLUMN     "paymentStatusDetail" TEXT,
ADD COLUMN     "providerCheckoutId" TEXT,
ADD COLUMN     "providerCheckoutUrl" TEXT,
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "providerRefundId" TEXT,
ADD COLUMN     "ticketExpiresAt" TIMESTAMP(3),
ADD COLUMN     "ticketUrl" TEXT;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_key_key" ON "PaymentEvent"("key");

-- CreateIndex
CREATE INDEX "PaymentEvent_orderId_createdAt_idx" ON "PaymentEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentProvider_providerPaymentId_key" ON "Order"("paymentProvider", "providerPaymentId");

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written (see the first migration): installments are 1 or more.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_installments_positive" CHECK ("installments" IS NULL OR "installments" > 0);
