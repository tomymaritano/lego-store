import type { PrismaClient } from "@/generated/prisma/client";
import { CONTENT_PAGES, CONTENT_SLUGS, type ContentSlug } from "@/lib/content/pages";
import { sameContent, type ContentDocument } from "@/lib/content/types";
import type { Db } from "@/lib/lists/product";
import { parseContentDocument } from "@/lib/validations/content";
import { diffFields, listAuditEntries, recordAudit, type AuditActor, type AuditEntryView } from "./audit";

/*
 * The admin's info pages (/admin/contenido): drafts, publishing and
 * discarding a draft. Client first; no permission checks here (./data.ts
 * and ./actions.ts). Every write records its audit entry ("content.draft",
 * "content.publish", "content.discard"; entity "content" / the page's slug)
 * in the same transaction; the caller expires the page's cache tag after a
 * publication.
 */

/** Published: the page shows the draft. Changed: the draft has edits the page does not show yet. Unpublished: never published. */
export type ContentStatus = "published" | "changed" | "unpublished";

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  published: "Publicada",
  changed: "Borrador sin publicar",
  unpublished: "Sin publicar",
};

export interface AdminContentRow {
  slug: ContentSlug;
  label: string;
  path: string;
  status: ContentStatus;
  publishedAt: string | null;
  publishedByEmail: string | null;
  updatedAt: string | null;
}

const EMPTY_DOC: ContentDocument = { title: "", description: "", blocks: [] };

function statusOf(draft: ContentDocument | null, published: ContentDocument | null): ContentStatus {
  if (!published) return "unpublished";
  return draft && !sameContent(draft, published) ? "changed" : "published";
}

export async function listAdminContent(db: Db): Promise<AdminContentRow[]> {
  const rows = await db.contentPage.findMany({ select: { slug: true, draft: true, published: true, publishedAt: true, publishedByEmail: true, updatedAt: true } });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return CONTENT_SLUGS.map((slug) => {
    const row = bySlug.get(slug);
    const { label, path } = CONTENT_PAGES[slug];
    return {
      slug,
      label,
      path,
      status: row ? statusOf(parseContentDocument(row.draft), parseContentDocument(row.published)) : "unpublished",
      publishedAt: row?.publishedAt?.toISOString() ?? null,
      publishedByEmail: row?.publishedByEmail ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export interface AdminContentPage extends AdminContentRow {
  /** What the editor starts from: the draft, else the published content, else an empty page. */
  draft: ContentDocument;
  published: ContentDocument | null;
  draftByEmail: string | null;
  history: AuditEntryView[];
}

export async function getAdminContentPage(db: Db, slug: ContentSlug): Promise<AdminContentPage> {
  const [row, history] = await Promise.all([db.contentPage.findUnique({ where: { slug } }), listAuditEntries(db, "content", slug)]);
  const draft = row ? parseContentDocument(row.draft) : null;
  const published = row ? parseContentDocument(row.published) : null;
  const { label, path } = CONTENT_PAGES[slug];
  return {
    slug,
    label,
    path,
    status: statusOf(draft, published),
    publishedAt: row?.publishedAt?.toISOString() ?? null,
    publishedByEmail: row?.publishedByEmail ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    draft: draft ?? published ?? EMPTY_DOC,
    published,
    draftByEmail: row?.draftByEmail ?? null,
    history,
  };
}

/** What an entry says changed between two versions: the title and lead word for word, the blocks only that they changed. */
function contentChanges(before: ContentDocument | null, after: ContentDocument) {
  const from = before ?? EMPTY_DOC;
  return diffFields(
    { title: from.title, description: from.description, blocks: JSON.stringify(from.blocks) },
    { title: after.title, description: after.description, blocks: JSON.stringify(after.blocks) }
  );
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** The page's row locked for this transaction (null while it has none). */
async function lockedRow(tx: Tx, slug: ContentSlug) {
  await tx.$queryRaw`SELECT "slug" FROM "ContentPage" WHERE "slug" = ${slug} FOR UPDATE`;
  return tx.contentPage.findUnique({ where: { slug } });
}

/** "Guardar borrador": the page keeps showing what was published. */
export function saveContentDraft(db: PrismaClient, actor: AuditActor, slug: ContentSlug, doc: ContentDocument): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const row = await lockedRow(tx, slug);
    const before = row ? parseContentDocument(row.draft) : null;
    if (before && sameContent(before, doc)) return { changed: false };
    const draft = doc as object;
    await tx.contentPage.upsert({
      where: { slug },
      create: { slug, draft, draftByEmail: actor.email },
      update: { draft, draftByEmail: actor.email },
    });
    await recordAudit(tx, actor, { action: "content.draft", entityType: "content", entityId: slug, changes: contentChanges(before, doc) });
    return { changed: true };
  });
}

/** "Publicar": the draft becomes what the page shows. `changed` is false when the page already showed exactly this. */
export function publishContent(db: PrismaClient, actor: AuditActor, slug: ContentSlug, doc: ContentDocument): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const row = await lockedRow(tx, slug);
    const published = row ? parseContentDocument(row.published) : null;
    const draftSame = row ? sameContent(parseContentDocument(row.draft), doc) : false;
    if (published && sameContent(published, doc) && draftSame) return { changed: false };
    const value = doc as object;
    const data = { draft: value, published: value, publishedAt: new Date(), publishedById: actor.id, publishedByEmail: actor.email, draftByEmail: actor.email };
    await tx.contentPage.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    await recordAudit(tx, actor, { action: "content.publish", entityType: "content", entityId: slug, changes: contentChanges(published, doc) });
    return { changed: true };
  });
}

/** "Descartar borrador": the draft goes back to what the page shows. False when there was nothing to discard. */
export function discardContentDraft(db: PrismaClient, actor: AuditActor, slug: ContentSlug): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const row = await lockedRow(tx, slug);
    const published = row ? parseContentDocument(row.published) : null;
    const draft = row ? parseContentDocument(row.draft) : null;
    if (!row || !published || sameContent(draft, published)) return { changed: false };
    await tx.contentPage.update({ where: { slug }, data: { draft: published as object, draftByEmail: actor.email } });
    await recordAudit(tx, actor, { action: "content.discard", entityType: "content", entityId: slug, changes: draft ? contentChanges(draft, published) : null });
    return { changed: true };
  });
}
