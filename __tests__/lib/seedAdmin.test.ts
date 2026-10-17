// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEV_ADMIN, isLocalDatabase, resolveAdmin } from "../../prisma/seed/admin";

const LOCAL = "postgresql://lego:lego@localhost:5433/lego_store";
const REMOTE = "postgresql://user:pw@db.example.com:5432/shop";

describe("resolveAdmin (seed admin from env)", () => {
  it("uses both variables when they are set", () => {
    expect(resolveAdmin({ ADMIN_EMAIL: " owner@shop.com ", ADMIN_PASSWORD: "s3cret-pass", DATABASE_URL: REMOTE })).toEqual({
      admin: { email: "owner@shop.com", password: "s3cret-pass" },
    });
  });

  it.each([
    ["unset", {}],
    ["empty, as in a copied .env.example", { ADMIN_EMAIL: "", ADMIN_PASSWORD: "" }],
    ["blank", { ADMIN_EMAIL: "  ", ADMIN_PASSWORD: " " }],
  ])("falls back to the dev admin on a local database when they are %s", (_label, env) => {
    const result = resolveAdmin({ ...env, DATABASE_URL: LOCAL });
    expect(result.admin).toEqual(DEV_ADMIN);
    expect(result.notice).toContain(DEV_ADMIN.email);
  });

  it("creates no admin on a non-local database without the variables", () => {
    const result = resolveAdmin({ ADMIN_EMAIL: "", ADMIN_PASSWORD: "", DATABASE_URL: REMOTE });
    expect(result.admin).toBeNull();
    expect(result.notice).toMatch(/no se crea el usuario admin/);
  });

  it("allows the dev admin elsewhere only with SEED_DEV_ADMIN=1", () => {
    expect(resolveAdmin({ DATABASE_URL: REMOTE, SEED_DEV_ADMIN: "1" }).admin).toEqual(DEV_ADMIN);
  });

  it.each([
    ["only the email", { ADMIN_EMAIL: "owner@real-shop.com" }, /Falta ADMIN_PASSWORD/],
    ["only the password", { ADMIN_PASSWORD: "s3cret-pass", ADMIN_EMAIL: "" }, /Falta ADMIN_EMAIL/],
  ])("refuses %s, even locally (never a real email with the dev password)", (_label, env, message) => {
    expect(() => resolveAdmin({ ...env, DATABASE_URL: LOCAL })).toThrow(message);
    expect(() => resolveAdmin({ ...env, DATABASE_URL: LOCAL, SEED_DEV_ADMIN: "1" })).toThrow(message);
  });

  it("recognises local connection strings", () => {
    expect(isLocalDatabase(LOCAL)).toBe(true);
    expect(isLocalDatabase("postgresql://a:b@127.0.0.1/x")).toBe(true);
    expect(isLocalDatabase("postgresql://a:b@[::1]:5432/x")).toBe(true);
    expect(isLocalDatabase(REMOTE)).toBe(false);
    expect(isLocalDatabase("not a url")).toBe(false);
    expect(isLocalDatabase(undefined)).toBe(false);
  });
});
