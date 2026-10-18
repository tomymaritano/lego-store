-- Info pages' content edited in /admin/contenido (src/lib/content): a draft
-- the editor saves and the published copy the page shows (both JSON
-- documents checked by the app on every write and read). The seed publishes
-- the pages' first content; no rows are inserted here.

-- CreateTable
CREATE TABLE "ContentPage" (
    "slug" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "publishedByEmail" TEXT,
    "draftByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("slug")
);

-- AddForeignKey
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

