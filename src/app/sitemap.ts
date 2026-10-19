import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getSitemapSource } from "@/lib/api";
import { buildSitemap } from "@/lib/sitemap";

/*
 * /sitemap.xml, from the database (src/lib/sitemap.ts says what is listed).
 * Its read is cached under the products, categories and content tags, so an
 * admin's change regenerates it on the next request; the hour is a safety net.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(siteConfig.url, await getSitemapSource());
}
