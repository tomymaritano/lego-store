import { z } from "zod";
import { CONTENT_LIMITS as L, type ContentDocument } from "@/lib/content/types";

/*
 * An info page's content (src/lib/content/types.ts), checked on every save
 * and publish from /admin/contenido and on every read from the database
 * (a row that does not match is treated as missing, never rendered half).
 * Texts are plain strings rendered as Markdown without raw HTML, so no
 * sanitising is needed here; the limits keep a page within reason.
 */

const id = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "Identificador no válido");

const text = (label: string, max: number, { required = true }: { required?: boolean } = {}) => {
  const base = z.string().trim().max(max, `${label}: como máximo ${max.toLocaleString("es-AR")} caracteres`);
  return required ? base.min(1, `Completa ${label.toLowerCase()}`) : base;
};

const markdownBlock = z.object({
  type: z.literal("markdown"),
  id,
  text: text("El texto", L.markdown),
});

const faqBlock = z.object({
  type: z.literal("faq"),
  id,
  title: text("El título del grupo", L.blockTitle),
  items: z
    .array(z.object({ id, question: text("La pregunta", L.question), answer: text("La respuesta", L.answer) }))
    .min(1, "Agrega al menos una pregunta")
    .max(L.faqItems, `Como máximo ${L.faqItems} preguntas por grupo`),
});

const listBlock = z.object({
  type: z.literal("list"),
  id,
  title: text("El título de la lista", L.blockTitle, { required: false }),
  style: z.enum(["steps", "cards"]),
  items: z
    .array(z.object({ id, title: text("El título del ítem", L.itemTitle), text: text("El texto del ítem", L.itemText) }))
    .min(1, "Agrega al menos un ítem")
    .max(L.listItems, `Como máximo ${L.listItems} ítems`),
});

export const contentDocumentSchema = z
  .object({
    title: text("El título", L.title),
    description: text("La introducción", L.description),
    blocks: z.array(z.discriminatedUnion("type", [markdownBlock, faqBlock, listBlock])).max(L.blocks, `Como máximo ${L.blocks} bloques`),
  })
  .refine((doc) => new Set(doc.blocks.map((block) => block.id)).size === doc.blocks.length, { message: "Hay dos bloques con el mismo identificador", path: ["blocks"] });

/** The document, or null when `value` is not a valid one. */
export function parseContentDocument(value: unknown): ContentDocument | null {
  const parsed = contentDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Where an issue is, in words the editor shows next to the field ("Bloque 2, pregunta 3"). */
export function contentIssuePath(path: readonly PropertyKey[]): string {
  const [root, blockIndex, key, itemIndex] = path;
  if (root !== "blocks" || typeof blockIndex !== "number") return "";
  const block = `Bloque ${blockIndex + 1}`;
  if (key === "items" && typeof itemIndex === "number") return `${block}, ítem ${itemIndex + 1}`;
  return block;
}
