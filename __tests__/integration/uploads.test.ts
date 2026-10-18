import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { saveUpload } from "@/lib/uploads";
import { diskStorage } from "@/lib/uploads/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/validate";
import { resetDatabase, testDb } from "./setup/db";

/*
 * Picture uploads against the test database and a temporary folder as the
 * disk storage: what is accepted (JPEG, PNG, WebP, AVIF by their bytes,
 * re-encoded to WebP variants with random names) and what is not (SVG,
 * renamed files, oversized ones, broken ones), the audit entry, and the
 * Route Handler's guards (admins only, same origin).
 */

type StubSession = { user: { id: string; role: string }; sessionVersion: number };
const session = vi.hoisted(() => ({ current: null as StubSession | null }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <F extends (...args: never[]) => unknown>(fn: F) => fn };
});

let dir: string;
let admin: { id: string; email: string };
let customer: { id: string; email: string };

const solid = (format: "png" | "jpeg" | "webp" | "avif", width = 2400, height = 1200) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    [format]()
    .toBuffer()
    .then((buffer) => new Uint8Array(buffer));

const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

beforeAll(async () => {
  await resetDatabase();
  dir = await mkdtemp(path.join(tmpdir(), "lego-uploads-"));
  process.env.UPLOADS_DIR = dir;
  const select = { id: true, email: true } as const;
  admin = await testDb.user.create({ data: { email: "jefa@subidas.test", role: "ADMIN" }, select });
  customer = await testDb.user.create({ data: { email: "cliente@subidas.test" }, select });
});

afterAll(async () => {
  delete process.env.UPLOADS_DIR;
  await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  session.current = null;
  await testDb.rateLimit.deleteMany();
});

describe("saveUpload", () => {
  it.each(["png", "jpeg", "webp", "avif"] as const)("accepts %s, re-encoded as one WebP of at most 1600 px", async (format) => {
    const result = await saveUpload(testDb, await solid(format), { actor: admin, storage: diskStorage(dir) });
    expect(result).toMatchObject({ ok: true, width: 1600, height: 800 });
    if (!result.ok) return;
    expect(result.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.webp$/);
    // From a buffer: sharp keeps files it opened by path locked on Windows (the cleanup could not delete them).
    const stored = await sharp(await readFile(path.join(dir, path.basename(result.url)))).metadata();
    expect(stored).toMatchObject({ format: "webp", width: 1600, height: 800 });
    expect(result).not.toHaveProperty("thumbnailUrl");
  });

  it("never enlarges a small picture, and names every upload at random", async () => {
    const first = await saveUpload(testDb, await solid("png", 300, 200), { actor: admin, storage: diskStorage(dir) });
    const second = await saveUpload(testDb, await solid("png", 300, 200), { actor: admin, storage: diskStorage(dir) });
    expect(first).toMatchObject({ ok: true, width: 300, height: 200 });
    expect(first.ok && second.ok && first.url !== second.url).toBe(true);
  });

  it("refuses SVG, a renamed text file, an empty or oversized file and a broken picture", async () => {
    const storage = diskStorage(dir);
    const before = (await readdir(dir)).length;
    expect(await saveUpload(testDb, SVG, { actor: admin, storage })).toMatchObject({ ok: false, reason: "unsupported" });
    expect(await saveUpload(testDb, new TextEncoder().encode("GIF89a not really"), { actor: admin, storage })).toMatchObject({ ok: false, reason: "unsupported" });
    expect(await saveUpload(testDb, new Uint8Array(), { actor: admin, storage })).toMatchObject({ ok: false, reason: "empty" });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await saveUpload(testDb, big, { actor: admin, storage })).toMatchObject({ ok: false, reason: "too_large" });
    // Real PNG magic bytes followed by garbage: it passes the first check, not the decoder.
    const broken = (await solid("png", 50, 50)).slice(0, 40);
    expect(await saveUpload(testDb, broken, { actor: admin, storage })).toMatchObject({ ok: false, reason: "unreadable", message: expect.stringContaining("dañado") });
    expect((await readdir(dir)).length).toBe(before);
  });

  it("without sharp the checked bytes are kept as they are", async () => {
    const bytes = await solid("jpeg", 40, 40);
    const result = await saveUpload(testDb, bytes, { actor: admin, storage: diskStorage(dir), useSharp: false });
    expect(result).toMatchObject({ ok: true, width: null });
    expect(result.ok && result.url).toMatch(/\.jpg$/);
  });

  it("is not configured on Vercel without a Blob token", async () => {
    expect(await saveUpload(testDb, await solid("png", 10, 10), { actor: admin, storage: null })).toMatchObject({ ok: false, reason: "unconfigured" });
  });

  it("records who uploaded what", async () => {
    const result = await saveUpload(testDb, await solid("webp", 64, 64), { actor: { ...admin, ip: "203.0.113.4" }, storage: diskStorage(dir) });
    if (!result.ok) throw new Error("upload failed");
    const id = path.basename(result.url, ".webp");
    expect(await testDb.auditLog.findFirst({ where: { entityType: "upload", entityId: id } })).toMatchObject({
      action: "upload.create",
      actorEmail: admin.email,
      ip: "203.0.113.4",
      changes: expect.objectContaining({ url: result.url, original: "webp", storage: "local" }),
    });
  });
});

describe("POST /api/admin/uploads", () => {
  const route = () => import("@/app/api/admin/uploads/route");

  const upload = (bytes: Uint8Array, { origin = "http://localhost", name = "foto.png" }: { origin?: string | null; name?: string } = {}) => {
    const form = new FormData();
    form.append("file", new File([bytes as Uint8Array<ArrayBuffer>], name, { type: "image/png" }));
    const headers: Record<string, string> = {};
    if (origin) headers.origin = origin;
    return route().then(({ POST }) => POST(new NextRequest(new URL("/api/admin/uploads", "http://localhost"), { method: "POST", body: form, headers })));
  };

  it("is for admins only, from the store itself", async () => {
    const png = await solid("png", 20, 20);
    expect((await upload(png)).status).toBe(401);
    session.current = { user: { id: customer.id, role: "ADMIN" }, sessionVersion: 0 };
    expect((await upload(png)).status).toBe(403);
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    expect((await upload(png, { origin: "https://evil.example" })).status).toBe(403);
    expect((await upload(png, { origin: null })).status).toBe(403);
  });

  it("stores a picture and refuses an SVG, whatever its name says", async () => {
    session.current = { user: { id: admin.id, role: "ADMIN" }, sessionVersion: 0 };
    const ok = await upload(await solid("png", 20, 20));
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ url: expect.stringMatching(/^\/uploads\/[a-f0-9]{32}\.webp$/) });
    const svg = await upload(SVG, { name: "foto.png" });
    expect(svg.status).toBe(422);
    expect(await svg.json()).toEqual({ error: expect.stringContaining("SVG") });
  });
});
