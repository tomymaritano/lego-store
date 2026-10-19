import "server-only";

import { CATALOG_TAGS, cached } from "@/lib/api/cache";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/lists/product";
import { parseContentDocument } from "@/lib/validations/content";
import type { ContentSlug } from "./pages";
import type { ContentDocument } from "./types";

/*
 * What the info pages read: a page's published content, through the data
 * cache under its own tag ("content:<slug>"), which "Publicar" expires
 * (updateContentCache). A page never published, or a row that does not
 * pass the schema, reads as null and the page is not found.
 */

export interface PublishedContent {
  doc: ContentDocument;
  /** ISO date of the publication (the legal pages' "Última actualización"). */
  publishedAt: string | null;
}

export async function readPublishedContent(db: Db, slug: ContentSlug): Promise<PublishedContent | null> {
  const row = await db.contentPage.findUnique({ where: { slug }, select: { published: true, publishedAt: true } });
  const doc = row?.published ? parseContentDocument(row.published) : null;
  if (!doc) return null;
  return { doc, publishedAt: row?.publishedAt?.toISOString() ?? null };
}

export const getPublishedContent: (slug: ContentSlug) => Promise<PublishedContent | null> = cached(
  "getPublishedContent",
  (slug: ContentSlug) => readPublishedContent(getDb(), slug),
  (slug) => [CATALOG_TAGS.content(slug)]
);
