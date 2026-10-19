// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEV_ADMIN, resolveAdmin } from "../../prisma/seed/admin";

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
  ])("uses the dev admin when they are %s and SEED_DEV_ADMIN=1", (_label, env) => {
    const result = resolveAdmin({ ...env, SEED_DEV_ADMIN: "1", DATABASE_URL: LOCAL });
    expect(result.admin).toEqual(DEV_ADMIN);
    expect(result.notice).toContain(DEV_ADMIN.email);
  });

  it("creates no admin without the opt-in, even on a local database", () => {
    for (const url of [LOCAL, REMOTE]) {
      const result = resolveAdmin({ ADMIN_EMAIL: "", ADMIN_PASSWORD: "", DATABASE_URL: url });
      expect(result.admin).toBeNull();
      expect(result.notice).toMatch(/no se crea el usuario admin/);
    }
  });

  it("never creates the dev admin with NODE_ENV=production (a production Postgres can be on localhost)", () => {
    expect(resolveAdmin({ NODE_ENV: "production", DATABASE_URL: "postgresql://app:secret@localhost:5432/shop" }).admin).toBeNull();
    const optedIn = resolveAdmin({ NODE_ENV: "production", DATABASE_URL: LOCAL, SEED_DEV_ADMIN: "1" });
    expect(optedIn.admin).toBeNull();
    expect(optedIn.notice).toMatch(/producción/);
  });

  it.each([
    ["only the email", { ADMIN_EMAIL: "owner@real-shop.com" }, /Falta ADMIN_PASSWORD/],
    ["only the password", { ADMIN_PASSWORD: "s3cret-pass", ADMIN_EMAIL: "" }, /Falta ADMIN_EMAIL/],
  ])("refuses %s (never a real email with the dev password)", (_label, env, message) => {
    expect(() => resolveAdmin({ ...env, DATABASE_URL: LOCAL })).toThrow(message);
    expect(() => resolveAdmin({ ...env, DATABASE_URL: LOCAL, SEED_DEV_ADMIN: "1" })).toThrow(message);
  });
});
