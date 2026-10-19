-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "resubscribeRequestedAt" TIMESTAMP(3),
ADD COLUMN     "resubscribeTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_resubscribeTokenHash_key" ON "NewsletterSubscriber"("resubscribeTokenHash");
