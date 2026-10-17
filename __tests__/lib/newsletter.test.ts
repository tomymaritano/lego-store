import { describe, it, expect } from "vitest";
import { validateNewsletterEmail } from "@/lib/validations/newsletter";

describe("validateNewsletterEmail", () => {
  it.each(["", "   "])("asks for an email when blank (%j)", (raw) => {
    expect(validateNewsletterEmail(raw)).toEqual({ ok: false, error: "Ingresa tu email" });
  });

  it.each(["no-es-un-email", "a@b", "a b@lego.com", "@lego.com", "fan@lego."])("rejects %s", (raw) => {
    expect(validateNewsletterEmail(raw)).toEqual({ ok: false, error: "Ingresa un email válido" });
  });

  it("accepts and trims a valid email", () => {
    expect(validateNewsletterEmail("  fan@lego.com ")).toEqual({ ok: true, email: "fan@lego.com" });
  });
});
