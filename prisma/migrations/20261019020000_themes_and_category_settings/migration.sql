-- Categories and themes edited from the admin (src/lib/admin/categories.ts,
-- src/lib/admin/themes.ts), and alt texts for every picture.
--
-- Themes: Product.theme (free text) becomes Product.themeId, a relation to the
-- new Theme table. Every distinct value gets its theme, with the same name,
-- so URLs and filters that use the name (?theme=Star%20Wars) keep working.
-- Order: the four themes of the old hard-coded "Temas" menu first, in that
-- order, then the rest A-Z; all visible.
--
-- Categories: visible (off hides them from the navigation, the home page and
-- the filters), an image alt text, and CategoryRedirect for slugs an admin
-- changed (Category.id is the slug; products follow by ON UPDATE CASCADE).
--
-- Products: imageAlts, one alt text per gallery image (same order as images),
-- filled from the product's name.

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Theme_slug_key" ON "Theme"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");

-- CreateIndex
CREATE INDEX "Theme_position_idx" ON "Theme"("position");

-- Data: one theme per distinct Product.theme. The slug is the name lowercased,
-- without accents, non-alphanumerics as "-" (src/lib/slug.ts does the same);
-- a slug two names share gets "-2", "-3"...
WITH names AS (
    SELECT DISTINCT "theme" AS name FROM "Product"
), slugged AS (
    SELECT
        name,
        COALESCE(
            NULLIF(
                regexp_replace(
                    regexp_replace(lower(translate(name, 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç', 'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc')), '[^a-z0-9]+', '-', 'g'),
                    '(^-+|-+$)', '', 'g'
                ),
                ''
            ),
            'tema'
        ) AS base,
        CASE name WHEN 'Star Wars' THEN 0 WHEN 'Marvel' THEN 1 WHEN 'Disney' THEN 2 WHEN 'Harry Potter' THEN 3 ELSE 4 END AS rank
    FROM names
), numbered AS (
    SELECT name, rank, base, row_number() OVER (PARTITION BY base ORDER BY name) AS n FROM slugged
)
INSERT INTO "Theme" ("id", "slug", "name", "position", "visible", "updatedAt")
SELECT
    'theme_' || substr(md5(name), 1, 20),
    CASE WHEN n = 1 THEN base ELSE base || '-' || n END,
    name,
    (row_number() OVER (ORDER BY rank, name) - 1)::int,
    true,
    CURRENT_TIMESTAMP
FROM numbered;

-- AlterTable: Product.theme -> Product.themeId
ALTER TABLE "Product" ADD COLUMN "themeId" TEXT;
UPDATE "Product" AS p SET "themeId" = t."id" FROM "Theme" AS t WHERE t."name" = p."theme";
ALTER TABLE "Product" ALTER COLUMN "themeId" SET NOT NULL;

-- DropIndex
DROP INDEX "Product_theme_idx";
ALTER TABLE "Product" DROP COLUMN "theme";

-- CreateIndex
CREATE INDEX "Product_themeId_idx" ON "Product"("themeId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: an alt text per gallery image, from the product's name.
ALTER TABLE "Product" ADD COLUMN "imageAlts" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Product" AS p SET "imageAlts" = ARRAY(
    SELECT CASE WHEN i = 1 THEN p."name" ELSE p."name" || ', imagen ' || i END
    FROM generate_subscripts(p."images", 1) AS i
    ORDER BY i
);

-- AlterTable: categories
ALTER TABLE "Category" ADD COLUMN "imageAlt" TEXT NOT NULL DEFAULT '',
ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Category" SET "imageAlt" = "name";

-- CreateTable
CREATE TABLE "CategoryRedirect" (
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryRedirect_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "CategoryRedirect_categoryId_idx" ON "CategoryRedirect"("categoryId");

-- AddForeignKey
ALTER TABLE "CategoryRedirect" ADD CONSTRAINT "CategoryRedirect_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
