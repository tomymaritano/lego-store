import "server-only";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STORE_TIME_ZONE } from "@/lib/argentina";
import { pageMetadata } from "@/lib/metadata";
import { getStoreSettings } from "@/lib/settings";
import type { StoreSettings } from "@/lib/settings/defaults";
import { getPublishedContent } from "./index";
import { CONTENT_PAGES, type ContentSlug } from "./pages";
import { fillDocument, markdownToText } from "./text";
import type { ContentDocument } from "./types";

/*
 * What every DB-backed info page does first: its published content with the
 * settings' placeholders filled (not found while it was never published),
 * and its metadata from that content.
 */

export interface LoadedContentPage {
  doc: ContentDocument;
  settings: StoreSettings;
  /** "17 de octubre de 2026", the publication's store day; null when unknown. */
  updated: string | null;
}

const longDate = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: STORE_TIME_ZONE });

export async function loadContentPage(slug: ContentSlug): Promise<LoadedContentPage> {
  const [content, settings] = await Promise.all([getPublishedContent(slug), getStoreSettings()]);
  if (!content) notFound();
  return {
    doc: fillDocument(content.doc, settings),
    settings,
    updated: content.publishedAt ? longDate.format(new Date(content.publishedAt)) : null,
  };
}

/** The page's title and description (plain text of its lead) from its published content. */
export async function contentMetadata(slug: ContentSlug): Promise<Metadata> {
  const [content, settings] = await Promise.all([getPublishedContent(slug), getStoreSettings()]);
  const { path, label } = CONTENT_PAGES[slug];
  if (!content) return { title: label };
  const doc = fillDocument(content.doc, settings);
  return pageMetadata({ title: doc.title, description: markdownToText(doc.description).slice(0, 300), path });
}
