import { afterEach, describe, expect, it, vi } from "vitest";
import { serverIdentity } from "@/lib/server-identity";

describe("serverIdentity", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("tells checkouts and databases apart, without giving either away", () => {
    const here = serverIdentity("/repo/lego-store", "postgresql://lego:lego@localhost:5433/lego_store");
    expect(here).toMatch(/^[0-9a-f]{16}$/);
    expect(serverIdentity("/repo/lego-store", "postgresql://lego:lego@localhost:5433/lego_store")).toBe(here);
    expect(serverIdentity("/repo/other-copy", "postgresql://lego:lego@localhost:5433/lego_store")).not.toBe(here);
    expect(serverIdentity("/repo/lego-store", "postgresql://lego:lego@localhost:5434/lego_store")).not.toBe(here);
    expect(here).not.toContain("lego");
  });

  it("is served only with the payments mock", async () => {
    const { GET } = await import("@/app/api/test/identity/route");
    vi.stubEnv("PAYMENTS_MOCK", "");
    expect(GET().status).toBe(404);
    vi.stubEnv("PAYMENTS_MOCK", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://x@localhost/db");
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ identity: serverIdentity(process.cwd(), "postgresql://x@localhost/db") });
  });
});
