import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

interface PageMetadataInput {
  /** Page title; the root layout's template appends " | LEGO Store". */
  title: string;
  description: string;
  /** Path of the page, for the canonical URL and og:url. */
  path: string;
  images?: { url: string; width?: number; height?: number; alt?: string }[];
}

/**
 * Metadata for a page. Next merges metadata shallowly, so a page that sets
 * `openGraph` replaces the root one entirely: this rebuilds it with the
 * site-wide locale (es_AR) and site name every time.
 */
export function pageMetadata({ title, description, path, images }: PageMetadataInput): Metadata {
  const fullTitle = siteConfig.seo.titleTemplate.replace("%s", title);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      url: path,
      title: fullTitle,
      description,
      ...(images ? { images } : null),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(images ? { images: images.map((image) => image.url) } : null),
    },
  };
}
