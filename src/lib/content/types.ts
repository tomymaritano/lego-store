/*
 * The info pages' content (ContentPage.draft / .published), as the app and
 * the admin's editor read it. Client-safe and dependency-free; the zod
 * schema that checks it on every write (and on read) is ./schema.ts.
 *
 * A page is a title, a lead (`description`, inline Markdown: links and bold)
 * and an ordered list of blocks:
 *
 * - markdown: long text in Markdown (headings, lists, links, tables). Raw
 *   HTML is never rendered (src/components/content/Markdown.tsx).
 * - faq: a titled group of questions and answers, in order (answers in
 *   Markdown). The FAQ page's structured data is built from them.
 * - list: a titled list of short items (a title and a line each), shown as
 *   numbered steps or as cards.
 *
 * Every text may use the settings' placeholders ({{costo_envio}}...,
 * src/lib/settings/placeholders.ts), filled when the page renders.
 */

export interface MarkdownBlock {
  type: "markdown";
  id: string;
  text: string;
}

export interface FaqItem {
  id: string;
  question: string;
  /** Markdown. */
  answer: string;
}

export interface FaqBlock {
  type: "faq";
  id: string;
  title: string;
  items: FaqItem[];
}

export interface ListItem {
  id: string;
  title: string;
  text: string;
}

export interface ListBlock {
  type: "list";
  id: string;
  title: string;
  /** Numbered steps (1, 2, 3...) or cards side by side. */
  style: "steps" | "cards";
  items: ListItem[];
}

export type ContentBlock = MarkdownBlock | FaqBlock | ListBlock;
export type ContentBlockType = ContentBlock["type"];

export interface ContentDocument {
  title: string;
  /** The lead under the title: inline Markdown (links, bold, italics). */
  description: string;
  blocks: ContentBlock[];
}

/** Limits the schema enforces (the editor shows them). */
export const CONTENT_LIMITS = {
  title: 120,
  description: 400,
  blocks: 30,
  markdown: 20_000,
  blockTitle: 120,
  faqItems: 60,
  question: 200,
  answer: 4000,
  listItems: 12,
  itemTitle: 80,
  itemText: 400,
} as const;

export const CONTENT_BLOCK_LABELS: Record<ContentBlockType, string> = {
  markdown: "Texto",
  faq: "Preguntas frecuentes",
  list: "Pasos o tarjetas",
};

/** Two documents say the same (the draft has no unpublished changes). */
export const sameContent = (a: ContentDocument | null, b: ContentDocument | null) => JSON.stringify(a) === JSON.stringify(b);
