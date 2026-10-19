-- The unsubscribe link's token is now the subscriber's id signed with
-- AUTH_SECRET (src/lib/newsletter), so any email can carry it and nothing
-- about it is stored. Links sent before this migration stop working.

-- DropIndex
DROP INDEX "NewsletterSubscriber_unsubscribeTokenHash_key";

-- AlterTable
ALTER TABLE "NewsletterSubscriber" DROP COLUMN "unsubscribeTokenHash";
