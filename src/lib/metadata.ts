import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

type OgImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * The site-wide social card (src/app/opengraph-image.tsx). A page that sets
 * `openGraph` loses the file-based image, so pages without their own image
 * point back to it explicitly.
 */
export const defaultOgImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${siteConfig.name}: sets LEGO originales`,
} as const satisfies OgImage;

interface PageMetadataInput {
  /** Page title; the root layout's template appends " | LEGO Store". */
  title: string;
  description: string;
  /** Path of the page, for the canonical URL and og:url. */
  path: string;
  /** Social images; defaults to the site-wide card. */
  images?: OgImage[];
}

/**
 * Metadata for a page. Next merges metadata shallowly, so a page that sets
 * `openGraph` replaces the root one entirely: this rebuilds it with the
 * site-wide locale (es_AR) and site name every time.
 */
export function pageMetadata({ title, description, path, images = [defaultOgImage] }: PageMetadataInput): Metadata {
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
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: images.map((image) => image.url),
    },
  };
}
