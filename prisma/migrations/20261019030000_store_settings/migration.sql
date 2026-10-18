-- Store settings edited in /admin/configuracion (src/lib/settings): shipping
-- cost and free-shipping threshold (lib/pricing reads them), the announcement
-- bar, contact details and social profiles (footer, /contacto), and the home
-- page's featured products in order.
--
-- StoreSettings is a single row (id = 1). It is not inserted here: the app
-- falls back to DEFAULT_STORE_SETTINGS while it is missing, and the seed (or
-- the admin's first save) writes it.

-- CreateEnum
CREATE TYPE "AnnouncementTone" AS ENUM ('BRAND', 'PRIMARY', 'INFO', 'SUCCESS', 'NEUTRAL');

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "shippingCost" INTEGER NOT NULL,
    "freeShippingFrom" INTEGER NOT NULL,
    "announcementActive" BOOLEAN NOT NULL DEFAULT true,
    "announcementText" TEXT NOT NULL DEFAULT '',
    "announcementLinkUrl" TEXT NOT NULL DEFAULT '',
    "announcementLinkLabel" TEXT NOT NULL DEFAULT '',
    "announcementTone" "AnnouncementTone" NOT NULL DEFAULT 'BRAND',
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactAddress" TEXT NOT NULL,
    "contactHours" TEXT NOT NULL,
    "socialFacebook" TEXT NOT NULL DEFAULT '',
    "socialInstagram" TEXT NOT NULL DEFAULT '',
    "socialYoutube" TEXT NOT NULL DEFAULT '',
    "socialX" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedProduct" (
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedProduct_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "FeaturedProduct_position_idx" ON "FeaturedProduct"("position");

-- AddForeignKey
ALTER TABLE "FeaturedProduct" ADD CONSTRAINT "FeaturedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints (Prisma's schema language has none).
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_single_row" CHECK ("id" = 1);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_shippingCost_positive" CHECK ("shippingCost" > 0);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_freeShippingFrom_positive" CHECK ("freeShippingFrom" > 0);
ALTER TABLE "FeaturedProduct" ADD CONSTRAINT "FeaturedProduct_position_nonnegative" CHECK ("position" >= 0);
