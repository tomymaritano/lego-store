import { describe, expect, it } from "vitest";
import { loginHref, safeCallbackUrl } from "@/lib/auth/callback-url";
import { normalizeEmail, roleForEmail } from "@/lib/auth/email";
import { authErrorMessage } from "@/lib/auth/error-messages";

describe("safeCallbackUrl", () => {
  it.each([
    ["/account", "/account"],
    ["/item/1?color=rojo#resenas", "/item/1?color=rojo#resenas"],
    ["/search?q=star%20wars", "/search?q=star%20wars"],
    ["/admin/../account", "/account"],
  ])("keeps the same-site path %s", (raw, expected) => {
    expect(safeCallbackUrl(raw)).toBe(expected);
  });

  it.each([
    ["another origin", "https://evil.example.com/robar"],
    ["protocol-relative", "//evil.example.com"],
    ["backslash host", "/\\evil.example.com"],
    ["encoded backslash in the host position", "/\\\\evil.example.com"],
    ["dot segment before a second slash", "/.//evil.example.com"],
    ["double-dot segment before a second slash", "/..//evil.example.com"],
    ["encoded dot segment", "/%2e//evil.example.com"],
    ["encoded double-dot segment", "/%2E%2E//evil.example.com/x"],
    ["segment undone by ..", "/a/..//evil.example.com/x"],
    ["javascript: URL", "javascript:alert(1)"],
    ["tab before a second slash", "/\t/evil.example.com"],
    ["newline", "/account\n"],
    ["relative without a slash", "account"],
    ["empty", ""],
    ["the login page (would loop)", "/login?callbackUrl=/account"],
    ["the register page", "/register"],
    ["an API route", "/api/auth/signout"],
    ["too long", `/${"a".repeat(3000)}`],
  ])("falls back for %s", (_label, raw) => {
    expect(safeCallbackUrl(raw)).toBe("/");
  });

  it("falls back for non-strings and uses the given fallback", () => {
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl(["/account"])).toBe("/");
    expect(safeCallbackUrl("https://evil.example.com", "/account")).toBe("/account");
  });
});

describe("loginHref", () => {
  it("adds the current page as callbackUrl, except for the home page", () => {
    expect(loginHref("/item/1")).toBe("/login?callbackUrl=%2Fitem%2F1");
    expect(loginHref("/")).toBe("/login");
    expect(loginHref("/account", "/register")).toBe("/register?callbackUrl=%2Faccount");
  });

  it("never carries an unsafe path or an auth page", () => {
    expect(loginHref("//evil.example.com")).toBe("/login");
    expect(loginHref("/login")).toBe("/login");
  });
});

describe("normalizeEmail / roleForEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ana.Perez@Example.COM ")).toBe("ana.perez@example.com");
  });

  it("gives ADMIN only to ADMIN_EMAIL, whatever the casing", () => {
    expect(roleForEmail("Admin@Tienda.com", " admin@tienda.COM ")).toBe("ADMIN");
    expect(roleForEmail("otra@tienda.com", "admin@tienda.com")).toBe("USER");
  });

  it("gives USER to everyone when ADMIN_EMAIL is unset or blank", () => {
    expect(roleForEmail("admin@tienda.com", undefined)).toBe("USER");
    expect(roleForEmail("admin@tienda.com", "   ")).toBe("USER");
    expect(roleForEmail("", "")).toBe("USER");
  });
});

describe("authErrorMessage", () => {
  it("explains the Auth.js error types in Spanish", () => {
    expect(authErrorMessage("OAuthAccountNotLinked")).toMatch(/Ya existe una cuenta con ese email/);
    expect(authErrorMessage("AccessDenied")).toMatch(/Google/);
  });

  it("uses a generic message for unknown types and nothing without one", () => {
    expect(authErrorMessage("Whatever")).toBe("No pudimos iniciar tu sesión. Vuelve a intentarlo.");
    expect(authErrorMessage("toString")).toBe("No pudimos iniciar tu sesión. Vuelve a intentarlo.");
    expect(authErrorMessage(undefined)).toBeUndefined();
    expect(authErrorMessage("")).toBeUndefined();
  });
});
