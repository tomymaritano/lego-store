import { slugify } from "@/lib/slug";
import { fillPlaceholders } from "@/lib/settings/placeholders";
import type { StoreSettings } from "@/lib/settings/defaults";
import type { ContentBlock, ContentDocument } from "./types";

/*
 * Plain-text helpers over the content's Markdown: what metadata, the FAQ's
 * structured data and the legal pages' table of contents need. Client-safe
 * (the editor's preview uses them too).
 */

/** Markdown down to its words: links keep their text, marks and heading hashes go. */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~`|]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every text of the document with the settings' placeholders filled (what the page renders). */
export function fillDocument(doc: ContentDocument, settings: StoreSettings): ContentDocument {
  const fill = (value: string) => fillPlaceholders(value, settings);
  const block = (b: ContentBlock): ContentBlock => {
    switch (b.type) {
      case "markdown":
        return { ...b, text: fill(b.text) };
      case "faq":
        return { ...b, title: fill(b.title), items: b.items.map((item) => ({ ...item, question: fill(item.question), answer: fill(item.answer) })) };
      case "list":
        return { ...b, title: fill(b.title), items: b.items.map((item) => ({ ...item, title: fill(item.title), text: fill(item.text) })) };
    }
  };
  return { title: fill(doc.title), description: fill(doc.description), blocks: doc.blocks.map(block) };
}

export interface LegalHeading {
  /** Anchor of the section ("que-datos-usamos"). */
  id: string;
  title: string;
  /** 1-based number across the page. */
  number: number;
  /** Which markdown block, and the heading's line in it (react-markdown's node position). */
  blockId: string;
  line: number;
}

/**
 * The `## ` headings of a page's Markdown blocks, numbered in order, with
 * unique anchors: the legal pages' sections and table of contents. Fenced
 * code is skipped.
 */
export function legalHeadings(blocks: ContentBlock[]): LegalHeading[] {
  const headings: LegalHeading[] = [];
  const used = new Map<string, number>();
  for (const block of blocks) {
    if (block.type !== "markdown") continue;
    let fenced = false;
    block.text.split(/\r?\n/).forEach((line, index) => {
      if (/^\s*```/.test(line)) fenced = !fenced;
      const match = !fenced && /^ {0,3}##\s+(.+?)\s*#*\s*$/.exec(line);
      if (!match) return;
      const title = markdownToText(match[1]!);
      const base = slugify(title) || "seccion";
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      headings.push({ id: seen ? `${base}-${seen + 1}` : base, title, number: headings.length + 1, blockId: block.id, line: index + 1 });
    });
  }
  return headings;
}
