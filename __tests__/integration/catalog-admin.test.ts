import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import { Client } from "pg";
import { getCategories, getCategoryById, getCategoryNames, getCategoryRedirect, getFilterOptions, getPaginatedProducts, getProductById, getThemes, searchProducts } from "@/lib/api";
import { createCategory, deleteCategory, getAdminCategory, moveCategory, updateCategory } from "@/lib/admin/categories";
import { createTheme, deleteTheme, moveTheme, updateTheme } from "@/lib/admin/themes";
import { categoryFormSchema, themeFormSchema } from "@/lib/validations/catalog";
import { testDatabaseUrl } from "../../prisma/test-database";
import { resetAndSeed, testDb } from "./setup/db";

/*
 * Categories and themes in the database, edited by the admin, against the
 * test database and read back through the storefront's gateway (its cache a
 * pass-through here): the themes migration (Product.theme -> Theme), slugs
 * that change with a redirect, the order, visibility, the delete guards,
 * the search columns that follow a rename, the audit entries, and who may
 * call the actions.
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
}));

const actions = await import("@/lib/admin/actions");

let admin: { id: string; email: string };

const category = (overrides: Partial<Record<string, unknown>> = {}) =>
  categoryFormSchema.parse({
    slug: "trenes",
    name: "Trenes",
    description: "Locomotoras y vagones",
    image: "/images/lego.png",
    imageAlt: "Una locomotora roja",
    visible: true,
    ...overrides,
  });

const entries = (entityType: string, entityId: string) =>
  testDb.auditLog.findMany({ where: { entityType, entityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { action: true, changes: true } });

beforeAll(async () => {
  await resetAndSeed();
  admin = await testDb.user.create({ data: { email: "jefa@catalogo.test", role: "ADMIN" }, select: { id: true, email: true } });
});

beforeEach(() => {
  session.current = null;
  vi.mocked(updateTag).mockClear();
});

describe("the themes migration", () => {
  const MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations");
  const THEMES = "20261019020000_themes_and_category_settings";

  it("turns every Product.theme into a Theme row (same name, slug, menu order) and fills the alt texts", async () => {
    const schema = `migration_check_${randomBytes(4).toString("hex")}`;
    const client = new Client({ connectionString: testDatabaseUrl() });
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
      const folders = readdirSync(MIGRATIONS).filter((name) => /^\d{14}_/.test(name)).sort();
      const sql = (folder: string) => readFileSync(path.join(MIGRATIONS, folder, "migration.sql"), "utf8");
      for (const folder of folders.slice(0, folders.indexOf(THEMES))) await client.query(sql(folder));

      await client.query(`
        INSERT INTO "Category" ("id", "name", "description", "image", "position", "updatedAt") VALUES ('cars', 'Vehículos', 'Autos', '/images/lego.png', 0, now());
        INSERT INTO "Product" ("id", "name", "price", "categoryId", "type", "age", "theme", "interests", "pieces", "highlight", "img", "images", "shortDescription", "description", "searchText", "searchName", "updatedAt")
        SELECT id, name, 100, 'cars', 'Set', '9+', theme, '{}', '1-100', 'Nuevo', '/images/lego.png', images, 'c', 'd', 's', 's', now()
        FROM (VALUES
          ('p1', 'Halcón', 'Technic', ARRAY['/images/a.png', '/images/b.png']),
          ('p2', 'Caza', 'Star Wars', ARRAY['/images/a.png']),
          ('p3', 'Casa', 'Ciudad Ñandú', ARRAY[]::text[]),
          ('p4', 'Torre', 'Ciudad-Ñandú', ARRAY['/images/c.png']),
          ('p5', 'Escudo', 'Marvel', ARRAY['/images/d.png']),
          ('p6', 'Otro caza', 'Star Wars', ARRAY['/images/e.png'])
        ) AS v(id, name, theme, images);
      `);
      await client.query(sql(THEMES));

      const themes = await client.query<{ name: string; slug: string; position: number; visible: boolean }>(
        `SELECT "name", "slug", "position", "visible" FROM "Theme" ORDER BY "position"`
      );
      expect(themes.rows).toEqual([
        // The old menu's themes first, in its order; then the rest A-Z; a shared slug gets "-2".
        { name: "Star Wars", slug: "star-wars", position: 0, visible: true },
        { name: "Marvel", slug: "marvel", position: 1, visible: true },
        { name: "Ciudad Ñandú", slug: "ciudad-nandu", position: 2, visible: true },
        { name: "Ciudad-Ñandú", slug: "ciudad-nandu-2", position: 3, visible: true },
        { name: "Technic", slug: "technic", position: 4, visible: true },
      ]);
      const products = await client.query<{ id: string; theme: string; imageAlts: string[] }>(
        `SELECT p."id", t."name" AS theme, p."imageAlts" FROM "Product" p JOIN "Theme" t ON t."id" = p."themeId" ORDER BY p."id"`
      );
      expect(products.rows).toEqual([
        { id: "p1", theme: "Technic", imageAlts: ["Halcón", "Halcón, imagen 2"] },
        { id: "p2", theme: "Star Wars", imageAlts: ["Caza"] },
        { id: "p3", theme: "Ciudad Ñandú", imageAlts: [] },
        { id: "p4", theme: "Ciudad-Ñandú", imageAlts: ["Torre"] },
        { id: "p5", theme: "Marvel", imageAlts: ["Escudo"] },
        { id: "p6", theme: "Star Wars", imageAlts: ["Otro caza"] },
      ]);
      const columns = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'Product' AND column_name = 'theme'`, [schema]);
      expect(columns.rowCount).toBe(0);
      expect((await client.query(`SELECT "imageAlt", "visible" FROM "Category"`)).rows).toEqual([{ imageAlt: "Vehículos", visible: true }]);
      // A theme in use cannot be deleted (Restrict).
      await expect(client.query(`DELETE FROM "Theme" WHERE "name" = 'Technic'`)).rejects.toThrow(/foreign key/);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });

  it("the seed is the same: the storefront reads themes by name, and the old URLs filter as before", async () => {
    expect((await getThemes()).map((theme) => theme.name)).toEqual(["Star Wars", "Marvel", "Disney", "Harry Potter", "Architecture", "Technic", "DC"]);
    const byName = await getPaginatedProducts({ themes: ["star wars"], limit: 48 });
    const bySlug = await getPaginatedProducts({ themes: ["star-wars"], limit: 48 });
    expect(byName.total).toBe(await testDb.product.count({ where: { theme: { name: "Star Wars" }, archivedAt: null } }));
    expect(bySlug.items.map((product) => product.id)).toEqual(byName.items.map((product) => product.id));
    expect(byName.items.every((product) => product.theme === "Star Wars")).toBe(true);
    expect((await getProductById("1"))?.imageAlts?.[0]).toBe("Captain Rex Helmet");
  });
});

describe("categories", () => {
  it("are created last in the order, with their audit entry; a taken slug is refused", async () => {
    const created = await createCategory(testDb, admin, category());
    expect(created).toMatchObject({ ok: true, categoryId: "trenes" });
    const all = await getCategories();
    expect(all.at(-1)).toMatchObject({ id: "trenes", name: "Trenes", imageAlt: "Una locomotora roja", productCount: 0 });
    expect(await createCategory(testDb, admin, category({ name: "Otra" }))).toEqual({ ok: false, reason: "slug_taken" });
    expect(await entries("category", "trenes")).toEqual([{ action: "category.create", changes: expect.objectContaining({ slug: "trenes", name: "Trenes" }) }]);
  });

  it("a new slug moves the products and redirects the old one; the history follows", async () => {
    const product = await testDb.product.findFirstOrThrow({ where: { categoryId: "ships" } });
    const count = await testDb.product.count({ where: { categoryId: "ships" } });
    const result = await updateCategory(testDb, admin, "ships", category({ slug: "naves-espaciales", name: "Naves espaciales" }));
    expect(result).toMatchObject({ ok: true, categoryId: "naves-espaciales", changed: true });
    expect(await testDb.product.count({ where: { categoryId: "naves-espaciales" } })).toBe(count);
    expect(await getCategoryRedirect("ships")).toBe("naves-espaciales");
    expect(await getCategoryRedirect("SHIPS")).toBe("naves-espaciales");
    expect(await getCategoryById("ships")).toBeNull();
    // Search matches the new name and slug: the search columns followed.
    expect((await searchProducts("espaciales")).map((p) => p.id)).toContain(product.id);
    expect(result.ok && result.productIds).toContain(product.id);

    // Another category cannot take the old slug: its links lead to "naves-espaciales".
    expect(await createCategory(testDb, admin, category({ slug: "ships", name: "Barcos" }))).toEqual({ ok: false, reason: "slug_redirect", categoryId: "naves-espaciales" });
    // Going back to it drops the redirect (it would point at itself).
    expect(await updateCategory(testDb, admin, "naves-espaciales", category({ slug: "ships", name: "Naves" }))).toMatchObject({ ok: true, categoryId: "ships" });
    expect(await getCategoryRedirect("ships")).toBeNull();
    expect(await getCategoryRedirect("naves-espaciales")).toBe("ships");

    const detail = (await getAdminCategory(testDb, "ships"))!;
    expect(detail.redirects).toEqual(["naves-espaciales"]);
    expect(detail.history.map((entry) => [entry.action, entry.entityId])).toEqual([
      ["category.update", "ships"],
      ["category.update", "naves-espaciales"],
    ]);
    expect(detail.history[1]!.changes).toMatchObject({ slug: ["ships", "naves-espaciales"], name: ["Naves", "Naves espaciales"] });
  });

  it("hidden: out of the navigation, the filters and its page; its products stay on sale and keep their category name", async () => {
    await updateCategory(testDb, admin, "robots", category({ slug: "robots", name: "Robots", visible: false }));
    try {
      expect((await getCategories()).map((c) => c.id)).not.toContain("robots");
      expect(await getCategoryById("robots")).toBeNull();
      expect((await getFilterOptions()).categories.map((option) => option.value)).not.toContain("robots");
      expect((await getCategoryNames()).find((c) => c.id === "robots")?.name).toBe("Robots");
      const product = await testDb.product.findFirstOrThrow({ where: { categoryId: "robots" } });
      expect(await getProductById(product.id)).not.toBeNull();
    } finally {
      await updateCategory(testDb, admin, "robots", category({ slug: "robots", name: "Robots", visible: true }));
    }
  });

  it("move up and down, recorded; the ends stay put", async () => {
    const order = async () => (await getCategories()).map((c) => c.id);
    const before = await order();
    expect(await moveCategory(testDb, admin, before[1]!, "up")).toEqual({ ok: true, moved: true });
    expect((await order()).slice(0, 2)).toEqual([before[1], before[0]]);
    expect(await moveCategory(testDb, admin, before[1]!, "up")).toEqual({ ok: true, moved: false });
    expect(await moveCategory(testDb, admin, before[1]!, "down")).toEqual({ ok: true, moved: true });
    expect(await order()).toEqual(before);
    expect((await entries("category", before[1]!)).map((entry) => entry.changes)).toEqual([{ position: [2, 1] }, { position: [1, 2] }]);
    expect(await moveCategory(testDb, admin, "nope", "up")).toEqual({ ok: false, reason: "not_found" });
  });

  it("only one no product uses can be deleted", async () => {
    expect(await deleteCategory(testDb, admin, "helmet")).toMatchObject({ ok: false, reason: "in_use" });
    expect(await deleteCategory(testDb, admin, "trenes")).toEqual({ ok: true });
    expect(await testDb.category.findUnique({ where: { id: "trenes" } })).toBeNull();
    expect((await entries("category", "trenes")).at(-1)).toMatchObject({ action: "category.delete" });
  });
});

describe("themes", () => {
  it("names are unique ignoring case and accents, slugs too", async () => {
    const created = await createTheme(testDb, admin, themeFormSchema.parse({ name: "Ninjago", slug: "ninjago", visible: true }));
    expect(created).toMatchObject({ ok: true });
    expect(await createTheme(testDb, admin, themeFormSchema.parse({ name: "NINJAGÓ", slug: "otro", visible: true }))).toEqual({ ok: false, reason: "name_taken" });
    expect(await createTheme(testDb, admin, themeFormSchema.parse({ name: "Otro", slug: "ninjago", visible: true }))).toEqual({ ok: false, reason: "slug_taken" });
    expect((await getThemes()).at(-1)?.name).toBe("Ninjago");
    // In use by no product: not a filter option yet, and it can go.
    expect((await getFilterOptions()).themes.map((option) => option.value)).not.toContain("ninjago");
    expect(created.ok && (await deleteTheme(testDb, admin, created.themeId))).toEqual({ ok: true });
  });

  it("a rename reaches the products (their label and search) and the filter keeps working by the new name", async () => {
    const technic = await testDb.theme.findUniqueOrThrow({ where: { name: "Technic" } });
    const result = await updateTheme(testDb, admin, technic.id, themeFormSchema.parse({ name: "Técnica", slug: "tecnica", visible: true }));
    expect(result).toMatchObject({ ok: true, changed: true });
    try {
      const products = await getPaginatedProducts({ themes: ["tecnica"], limit: 48 });
      expect(products.total).toBeGreaterThan(0);
      expect(products.items.every((product) => product.theme === "Técnica")).toBe(true);
      expect((await searchProducts("tecnica")).length).toBe(products.total);
      expect((await entries("theme", technic.id)).at(-1)).toMatchObject({ action: "theme.update", changes: { name: ["Technic", "Técnica"], slug: ["technic", "tecnica"] } });
    } finally {
      await updateTheme(testDb, admin, technic.id, themeFormSchema.parse({ name: "Technic", slug: "technic", visible: true }));
    }
  });

  it("hidden: out of the menu and the filter list, still on its products; not deleted while in use; reordered", async () => {
    const marvel = await testDb.theme.findUniqueOrThrow({ where: { name: "Marvel" } });
    await updateTheme(testDb, admin, marvel.id, themeFormSchema.parse({ name: "Marvel", slug: "marvel", visible: false }));
    expect((await getThemes()).map((theme) => theme.name)).not.toContain("Marvel");
    expect((await getFilterOptions()).themes.map((option) => option.value)).not.toContain("marvel");
    expect((await getPaginatedProducts({ themes: ["Marvel"] })).total).toBeGreaterThan(0);
    await updateTheme(testDb, admin, marvel.id, themeFormSchema.parse({ name: "Marvel", slug: "marvel", visible: true }));

    expect(await deleteTheme(testDb, admin, marvel.id)).toMatchObject({ ok: false, reason: "in_use" });
    expect(await moveTheme(testDb, admin, marvel.id, "up")).toEqual({ ok: true, moved: true });
    expect((await getThemes())[0]!.name).toBe("Marvel");
    await moveTheme(testDb, admin, marvel.id, "down");
    expect((await getThemes()).map((theme) => theme.name).slice(0, 2)).toEqual(["Star Wars", "Marvel"]);
  });
});

describe("the actions", () => {
  const form = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  };

  it("admins only", async () => {
    await expect(actions.saveCategoryAction(null, {}, form({}))).rejects.toThrow(/NEXT_REDIRECT \/login/);
    await expect(actions.moveThemeAction("x", "up")).rejects.toThrow(/NEXT_REDIRECT \/login/);
    const customer = await testDb.user.create({ data: { email: "cliente@catalogo.test" } });
    session.current = { user: { id: customer.id, role: "ADMIN" }, sessionVersion: 0 };
    await expect(actions.deleteCategoryAction("helmet")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    await expect(actions.saveThemeAction(null, {}, form({}))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
  });

  it("validate the form, explain conflicts and expire the catalogue tags", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    const invalid = await actions.saveCategoryAction("helmet", {}, form({ slug: "Mal Slug", name: "", description: "x", image: "https://evil.example/x.png", imageAlt: "" }));
    expect(invalid).toMatchObject({ status: "error", fieldErrors: { slug: expect.any(String), name: expect.any(String), image: expect.any(String), imageAlt: expect.any(String) } });

    const taken = await actions.saveCategoryAction("helmet", {}, form({ slug: "cars", name: "Cascos", description: "x", image: "/images/lego.png", imageAlt: "x", visible: "on" }));
    expect(taken).toMatchObject({ status: "error", fieldErrors: { slug: "Ya hay una categoría con ese slug." } });

    const helmet = await testDb.category.findUniqueOrThrow({ where: { id: "helmet" } });
    const saved = await actions.saveCategoryAction(
      "helmet",
      {},
      form({ slug: "helmet", name: helmet.name, description: "Cascos de colección", image: helmet.image, imageAlt: helmet.imageAlt, visible: "on" })
    );
    expect(saved).toMatchObject({ status: "success" });
    expect(vi.mocked(updateTag).mock.calls.flat()).toEqual(expect.arrayContaining(["categories", "products"]));

    vi.mocked(updateTag).mockClear();
    const theme = await testDb.theme.findUniqueOrThrow({ where: { name: "Disney" } });
    expect(await actions.moveThemeAction(theme.id, "down")).toMatchObject({ ok: true });
    expect(vi.mocked(updateTag).mock.calls.flat()).toEqual(expect.arrayContaining(["themes"]));
    await actions.moveThemeAction(theme.id, "up");
    expect(await actions.deleteThemeAction(theme.id)).toMatchObject({ ok: false, error: expect.stringContaining("cámbiales el tema") });
  });
});
