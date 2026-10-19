-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- Check constraints (Prisma's schema language has none; see the init migration).
ALTER TABLE "User"
  ADD CONSTRAINT "User_sessionVersion_nonnegative" CHECK ("sessionVersion" >= 0);

ALTER TABLE "RateLimit"
  ADD CONSTRAINT "RateLimit_count_positive" CHECK ("count" > 0);
