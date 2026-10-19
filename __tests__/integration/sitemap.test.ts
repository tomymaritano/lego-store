import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { getSitemapSource } from "@/lib/api";
import { CONTENT_SLUGS } from "@/lib/content/pages";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { siteConfig } from "@/config/site";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * What /sitemap.xml reads (src/lib/api getSitemapSource), against the test
 * database: the seeded catalogue minus what the storefront does not show
 * (archived products, hidden categories, info pages without valid published
 * content).
 */

beforeAll(async () => {
  await resetAndSeed();
});

describe("getSitemapSource", () => {
  it("lists every product on sale, every visible category and every published info page", async () => {
    const source = await getSitemapSource();
    const products = await testDb.product.findMany({ where: { archivedAt: null }, select: { id: true } });
    const categories = await testDb.category.findMany({ where: { visible: true }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true } });

    expect(source.products.map((product) => product.id).sort()).toEqual(products.map((product) => product.id).sort());
    expect(source.categories.map((category) => category.id)).toEqual(categories.map((category) => category.id));
    // The seed publishes every info page.
    expect(source.pages.map((page) => page.slug)).toEqual([...CONTENT_SLUGS]);
    for (const product of source.products) expect(Date.parse(product.updatedAt)).not.toBeNaN();
    for (const page of source.pages) expect(page.publishedAt && Date.parse(page.publishedAt)).not.toBeNaN();
  });

  it("is what /sitemap.xml and /robots.txt serve", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls[0]).toBe(new URL("/", siteConfig.url).toString());
    expect(urls).toContain(new URL("/item/1", siteConfig.url).toString());
    expect(urls).toContain(new URL("/faq", siteConfig.url).toString());
    expect(urls.some((url) => new URL(url).pathname.startsWith("/admin"))).toBe(false);
    expect(robots()).toMatchObject({ sitemap: new URL("/sitemap.xml", siteConfig.url).toString() });
  });

  it("leaves out archived products, hidden categories and pages that are not published or do not pass the schema", async () => {
    await testDb.product.update({ where: { id: "1" }, data: { archivedAt: new Date() } });
    const hidden = await testDb.category.findFirstOrThrow({ orderBy: { position: "asc" }, select: { id: true } });
    await testDb.category.update({ where: { id: hidden.id }, data: { visible: false } });
    await testDb.contentPage.update({ where: { slug: "privacidad" }, data: { published: Prisma.DbNull, publishedAt: null } });
    await testDb.contentPage.update({ where: { slug: "terminos" }, data: { published: { title: "" } } });

    const source = await getSitemapSource();
    expect(source.products.map((product) => product.id)).not.toContain("1");
    // A product of the hidden category is still on sale, with its own page.
    const inHidden = await testDb.product.findFirst({ where: { categoryId: hidden.id, archivedAt: null }, select: { id: true } });
    if (inHidden) expect(source.products.map((product) => product.id)).toContain(inHidden.id);
    expect(source.categories.map((category) => category.id)).not.toContain(hidden.id);
    expect(source.pages.map((page) => page.slug)).toEqual(CONTENT_SLUGS.filter((slug) => slug !== "privacidad" && slug !== "terminos"));
  });
});
