import type { MetadataRoute } from "next";
import type { SitemapSource } from "@/lib/api/catalog";
import { CONTENT_PAGES } from "@/lib/content/pages";

/*
 * What crawlers are told (src/app/sitemap.ts, src/app/robots.ts). Pure, so
 * the tests check the output without a server.
 *
 * The sitemap lists only indexable pages: the home page, the info pages with
 * published content, the visible categories and the products on sale. Pages
 * marked noindex (cart, wishlist, compare, search, login, register, checkout,
 * account, admin, the newsletter's token pages) are never in it.
 */

/**
 * Paths crawlers should not fetch: private (admin, account), transactional
 * (checkout, the newsletter's token links) or not pages at all (the API).
 * Their pages are also noindex.
 */
export const ROBOTS_DISALLOW = ["/admin", "/account", "/checkout", "/newsletter/", "/api/"] as const;

const absolute = (siteUrl: string, path: string) => new URL(path, siteUrl).toString();

export function buildSitemap(siteUrl: string, source: SitemapSource): MetadataRoute.Sitemap {
  return [
    { url: absolute(siteUrl, "/"), changeFrequency: "daily", priority: 1 },
    ...source.categories.map((category) => ({
      url: absolute(siteUrl, `/category/${encodeURIComponent(category.id)}`),
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...source.products.map((product) => ({
      url: absolute(siteUrl, `/item/${encodeURIComponent(product.id)}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...source.pages.map((page) => ({
      url: absolute(siteUrl, CONTENT_PAGES[page.slug].path),
      ...(page.publishedAt ? { lastModified: page.publishedAt } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}

export function buildRobots(siteUrl: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] },
    sitemap: absolute(siteUrl, "/sitemap.xml"),
  };
}
