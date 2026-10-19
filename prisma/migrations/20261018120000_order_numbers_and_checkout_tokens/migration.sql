-- Human-friendly order numbers, the guest checkout access token and the
-- first payment attempt ("Mis pedidos" lists only submitted orders).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutTokenHash" TEXT,
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- Orders that already got past checkout count as submitted.
UPDATE "Order" SET "submittedAt" = COALESCE("paidAt", "createdAt") WHERE "status" <> 'PENDING' OR "paidAt" IS NOT NULL;

-- Numbers start at 1001 (rows that already exist are renumbered above 1000).
-- START WITH too, so a TRUNCATE ... RESTART IDENTITY (the integration tests) starts there again.
UPDATE "Order" SET "number" = "number" + 1000;
ALTER SEQUENCE "Order_number_seq" START WITH 1001;
SELECT setval('"Order_number_seq"', GREATEST(1001, (SELECT COALESCE(MAX("number") + 1, 1001) FROM "Order")), false);

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");
