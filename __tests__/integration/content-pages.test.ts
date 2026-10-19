import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, updateTag } from "next/cache";
import { seedContent } from "@/data/content";
import { getPublishedContent } from "@/lib/content";
import type { ContentDocument } from "@/lib/content/types";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * The info pages' content against the test database: the seed publishes
 * every page once (and never overwrites an admin's edits), drafts leave the
 * page alone, "Publicar" changes what the page reads and expires its cache
 * tag and path, "Descartar" goes back, every action is the admin's and is
 * audited, and nothing the schema refuses reaches the page.
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { url });
  },
  forbidden: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;403");
  },
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

const actions = await import("@/lib/admin/actions");
const { seedDatabase } = await import("../../prisma/seed/index");

let admin: { id: string; email: string };

const asAdmin = () => {
  session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
};

const faqWith = (question: string): ContentDocument => {
  const doc = structuredClone(seedContent.faq);
  const first = doc.blocks[0];
  if (first?.type !== "faq") throw new Error("the seed's FAQ starts with a question group");
  first.items = [{ id: "nueva", question, answer: "Sí: **todos** los días, con [envío](/envios)." }, ...first.items];
  return doc;
};

const contentEntries = (slug: string) =>
  testDb.auditLog.findMany({ where: { entityType: "content", entityId: slug }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { action: true, changes: true } });

beforeAll(async () => {
  await resetAndSeed();
  admin = await testDb.user.create({ data: { email: "editora@contenido.test", role: "ADMIN" }, select: { id: true, email: true } });
});

beforeEach(() => {
  session.current = null;
  vi.mocked(updateTag).mockClear();
  vi.mocked(revalidatePath).mockClear();
});

describe("the seed", () => {
  it("publishes every info page", async () => {
    for (const [slug, doc] of Object.entries(seedContent)) {
      expect(await getPublishedContent(slug as keyof typeof seedContent)).toMatchObject({ doc, publishedAt: expect.any(String) });
    }
  });
});

describe("the editor's actions", () => {
  it("are for admins only and refuse unknown pages and invalid documents", async () => {
    await expect(actions.publishContentAction("faq", seedContent.faq)).rejects.toThrow(/NEXT_REDIRECT \/login/);
    const customer = await testDb.user.create({ data: { email: "cliente@contenido.test" } });
    session.current = { user: { id: customer.id, role: "ADMIN" }, sessionVersion: 0 };
    await expect(actions.saveContentDraftAction("faq", seedContent.faq)).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");

    asAdmin();
    expect(await actions.publishContentAction("admin", seedContent.faq)).toEqual({ ok: false, error: "Esa página no existe." });
    const invalid = await actions.publishContentAction("faq", { ...seedContent.faq, title: "", blocks: [{ type: "faq", id: "g", title: "Grupo", items: [{ id: "q", question: "", answer: "x" }] }] });
    expect(invalid).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.stringContaining("título"), "Bloque 1, ítem 1: Completa la pregunta"]) });
    expect(await actions.publishContentAction("faq", { ...seedContent.faq, blocks: [{ type: "html", id: "x", html: "<script>alert(1)</script>" }] })).toMatchObject({ ok: false });
    expect(updateTag).not.toHaveBeenCalled();
    expect(await contentEntries("faq")).toEqual([]);
    expect((await getPublishedContent("faq"))?.doc).toEqual(seedContent.faq);
  });

  it("save a draft without touching the page", async () => {
    asAdmin();
    const draft = faqWith("¿Hacen envíos el fin de semana?");
    expect(await actions.saveContentDraftAction("faq", draft)).toMatchObject({ ok: true });
    expect((await getPublishedContent("faq"))?.doc).toEqual(seedContent.faq);
    expect(updateTag).not.toHaveBeenCalled();
    const row = await testDb.contentPage.findUniqueOrThrow({ where: { slug: "faq" } });
    expect(row).toMatchObject({ draft, draftByEmail: admin.email });
    expect(await contentEntries("faq")).toEqual([{ action: "content.draft", changes: { blocks: [expect.any(String), expect.any(String)] } }]);
  });

  it("publish: the page reads the new content and its tag and path are expired", async () => {
    asAdmin();
    const doc = { ...faqWith("¿Hacen envíos el fin de semana?"), title: "Ayuda y preguntas frecuentes" };
    expect(await actions.publishContentAction("faq", doc)).toEqual({ ok: true, message: "Publicamos la página. Ya se ve en la tienda." });
    expect(vi.mocked(updateTag).mock.calls.flat()).toContain("content:faq");
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toContain("/faq");
    const published = await getPublishedContent("faq");
    expect(published?.doc).toEqual(doc);
    expect(new Date(published!.publishedAt!).getTime()).toBeGreaterThan(Date.now() - 60_000);
    const row = await testDb.contentPage.findUniqueOrThrow({ where: { slug: "faq" } });
    expect(row).toMatchObject({ publishedById: admin.id, publishedByEmail: admin.email });
    const entry = (await contentEntries("faq")).at(-1);
    expect(entry).toMatchObject({ action: "content.publish", changes: { title: ["Preguntas frecuentes", "Ayuda y preguntas frecuentes"] } });

    // The same again: nothing to publish, nothing expired.
    vi.mocked(updateTag).mockClear();
    expect(await actions.publishContentAction("faq", doc)).toEqual({ ok: true, message: "La página ya mostraba esta versión." });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("discard a draft: back to the published content", async () => {
    asAdmin();
    const published = (await getPublishedContent("faq"))!.doc;
    await actions.saveContentDraftAction("faq", { ...published, description: "Un borrador que no va a salir." });
    expect(await actions.discardContentDraftAction("faq")).toMatchObject({ ok: true });
    expect((await testDb.contentPage.findUniqueOrThrow({ where: { slug: "faq" } })).draft).toEqual(published);
    expect((await contentEntries("faq")).at(-1)).toMatchObject({ action: "content.discard" });
    expect(await actions.discardContentDraftAction("faq")).toEqual({ ok: true, message: "No había un borrador para descartar." });
  });

  it("a re-seed keeps the admin's content", async () => {
    const before = await getPublishedContent("faq");
    await seedDatabase(testDb, { admin: null });
    expect(await getPublishedContent("faq")).toEqual(before);
  });

  it("a row the schema refuses reads as no content (the page is not found), never half rendered", async () => {
    await testDb.contentPage.update({ where: { slug: "terminos" }, data: { published: { title: "x", blocks: "<script>" } } });
    expect(await getPublishedContent("terminos")).toBeNull();
    const { loadContentPage } = await import("@/lib/content/page");
    await expect(loadContentPage("terminos")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
