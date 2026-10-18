import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { decode, encode } from "next-auth/jwt";
import { changeUserPassword, registerUser, revokeAllSessions, updateUserName } from "@/lib/auth/accounts";
import { refreshSessionToken, sessionRenewal } from "@/lib/auth/session-token";
import { resetDatabase, testDb } from "./setup/db";

/*
 * Revoking a JWT session with sessionVersion, against the test database and
 * Auth.js's real route handlers: a token made stale by a password change
 * must stay stale, even when its holder asks Auth.js to refresh it through
 * POST /api/auth/session (open to any client with a CSRF token). Only a
 * renewal signed on the server (the password-change action's) moves a token
 * to the new version.
 */

const SECRET = "integration-test-secret-revocation";
const SALT = "authjs.session-token";
const PASSWORD = "bloques-de-prueba-42";

vi.stubEnv("AUTH_SECRET", SECRET);
vi.stubEnv("AUTH_TRUST_HOST", "true");

const { handlers } = await import("@/lib/auth");

let counter = 0;
async function newUser() {
  const result = await registerUser({ name: "Ana", email: `revocada-${++counter}@tienda.test`, password: PASSWORD });
  if (!result.ok) throw new Error("could not register");
  return result.user;
}

const tokenFor = (user: { id: string; email: string }, sv: number) =>
  encode({ token: { sub: user.id, email: user.email, name: "Ana", role: "USER", sv }, secret: SECRET, salt: SALT });

function request(path: string, cookies: Record<string, string>, init: { method?: string; body?: string } = {}) {
  return new NextRequest(new URL(path, "http://localhost"), {
    ...init,
    headers: {
      host: "localhost",
      "x-forwarded-proto": "http",
      "content-type": "application/json",
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    },
  });
}

function setCookies(response: Response): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    jar[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return jar;
}

/** What a client holding `sessionToken` gets back from POST /api/auth/session with `data`. */
async function askForRefresh(sessionToken: string, data: unknown) {
  const csrf = await handlers.GET(request("/api/auth/csrf", { [SALT]: sessionToken }));
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const response = await handlers.POST(
    request("/api/auth/session", { [SALT]: sessionToken, ...setCookies(csrf) }, { method: "POST", body: JSON.stringify({ csrfToken, data }) })
  );
  const issued = setCookies(response)[SALT];
  return {
    status: response.status,
    body: (await response.json()) as { sessionVersion?: number } | null,
    /** The re-issued token's payload; null when Auth.js cleared the cookie (or sent none). */
    token: issued ? await decode({ token: issued, secret: SECRET, salt: SALT }) : null,
  };
}

beforeAll(async () => {
  await resetDatabase();
});

describe("POST /api/auth/session (any client can call it)", () => {
  it("refreshes a current token (name from the database, same version)", async () => {
    const user = await newUser();
    await updateUserName(user.id, "Ana María");
    const result = await askForRefresh(await tokenFor(user, 0), {});
    expect(result.status).toBe(200);
    expect(result.token).toMatchObject({ sub: user.id, name: "Ana María", sv: 0 });
  });

  it("does not revive a token revoked by a password change", async () => {
    const user = await newUser();
    const stolen = await tokenFor(user, 0);
    expect(await changeUserPassword(user.id, PASSWORD, "otra-clave-segura-7")).toMatchObject({ ok: true });

    const result = await askForRefresh(stolen, {});
    expect(result.token).toBeNull();
    expect(result.body?.sessionVersion).toBeUndefined();
  });

  it("does not take a renewal the client made up, nor one for another move", async () => {
    const user = await newUser();
    const stolen = await tokenFor(user, 0);
    await changeUserPassword(user.id, PASSWORD, "otra-clave-segura-7");

    const forged = { userId: user.id, from: 0, to: 1, expiresAt: Date.now() + 60_000, signature: "x".repeat(43) };
    expect((await askForRefresh(stolen, { renewal: forged })).token).toBeNull();

    // A genuine renewal, but for a different move (from version 1, as a later change would issue).
    const other = sessionRenewal(user.id, 1, 2)!;
    expect((await askForRefresh(stolen, { renewal: other })).token).toBeNull();
  });
});

describe("refreshSessionToken", () => {
  it("moves the token to the new version with the server's renewal (the password-change action)", async () => {
    const user = await newUser();
    const result = await changeUserPassword(user.id, PASSWORD, "otra-clave-segura-7");
    if (!result.ok) throw new Error("password change failed");
    expect(result.sessionVersion).toEqual({ from: 0, to: 1 });

    const renewal = sessionRenewal(user.id, result.sessionVersion.from, result.sessionVersion.to)!;
    const token = { sub: user.id, role: "USER" as const, sv: 0 };
    expect(await refreshSessionToken(token, { renewal })).toMatchObject({ sub: user.id, sv: 1 });
    // Expired renewals do not count.
    expect(await refreshSessionToken(token, { renewal }, renewal.expiresAt + 1)).toBeNull();
  });

  it("ends every session of the account after revokeAllSessions (logout everywhere, an admin's logout)", async () => {
    const user = await newUser();
    const copied = await tokenFor(user, 0);
    await revokeAllSessions(user.id);

    expect((await testDb.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(1);
    expect(await refreshSessionToken({ sub: user.id, sv: 0 }, {})).toBeNull();
    expect((await askForRefresh(copied, {})).token).toBeNull();
  });

  it("ends the session of a deleted user", async () => {
    const user = await newUser();
    await testDb.user.delete({ where: { id: user.id } });
    expect(await refreshSessionToken({ sub: user.id, sv: 0 }, {})).toBeNull();
  });
});
