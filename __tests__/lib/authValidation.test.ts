import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  fieldErrors,
  loginSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validations/auth";
import { MAX_PASSWORD_BYTES } from "@/lib/auth/password-rules";

const valid = { name: "Ana Pérez", email: "ana@example.com", password: "bloques-42", confirmPassword: "bloques-42" };

function errorsOf(result: ReturnType<typeof registerSchema.safeParse>) {
  return result.success ? {} : fieldErrors(result.error);
}

describe("registerSchema", () => {
  it("accepts a valid sign-up and normalises the email", () => {
    const result = registerSchema.parse({ ...valid, name: "  Ana Pérez ", email: "  Ana@Example.COM " });
    expect(result).toMatchObject({ name: "Ana Pérez", email: "ana@example.com" });
  });

  it("explains every invalid field in Spanish, one message per field", () => {
    const errors = errorsOf(registerSchema.safeParse({ name: "A", email: "nope", password: "corta", confirmPassword: "" }));
    expect(errors).toEqual({
      name: "Ingresa tu nombre (al menos 2 caracteres)",
      email: "Ingresa un email válido",
      password: "La contraseña tiene que tener al menos 8 caracteres",
      confirmPassword: "Repite la contraseña",
    });
  });

  it("asks for each missing field", () => {
    const errors = errorsOf(registerSchema.safeParse({ name: "", email: "", password: "", confirmPassword: "" }));
    expect(errors.name).toBe("Ingresa tu nombre (al menos 2 caracteres)");
    expect(errors.email).toBe("Ingresa tu email");
    expect(errors.password).toBe("Ingresa una contraseña");
  });

  it("rejects passwords that do not match", () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, confirmPassword: "otra-cosa-42" }))).toEqual({
      confirmPassword: "Las contraseñas no coinciden",
    });
  });

  it(`rejects passwords over ${MAX_PASSWORD_BYTES} UTF-8 bytes, counting multi-byte characters`, () => {
    const ascii = "a".repeat(MAX_PASSWORD_BYTES);
    expect(registerSchema.safeParse({ ...valid, password: ascii, confirmPassword: ascii }).success).toBe(true);
    const tooLong = "a".repeat(MAX_PASSWORD_BYTES + 1);
    expect(errorsOf(registerSchema.safeParse({ ...valid, password: tooLong, confirmPassword: tooLong })).password).toMatch(
      /demasiado larga/
    );
    // 36 "ñ" are 36 characters but 72 bytes; one more is over the limit.
    const enes = "ñ".repeat(37);
    expect(registerSchema.safeParse({ ...valid, password: enes, confirmPassword: enes }).success).toBe(false);
  });

  it("caps the name and email length", () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, name: "x".repeat(81) })).name).toMatch(/80 caracteres/);
    expect(errorsOf(registerSchema.safeParse({ ...valid, email: `${"x".repeat(250)}@a.com` })).email).toBe(
      "El email es demasiado largo"
    );
  });

  it("rejects non-string input instead of throwing", () => {
    expect(registerSchema.safeParse({ name: 1, email: null, password: {}, confirmPassword: [] }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("only needs a valid email and some password (the hash decides)", () => {
    expect(loginSchema.parse({ email: "ANA@example.com", password: "x" })).toEqual({ email: "ana@example.com", password: "x" });
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success ? {} : fieldErrors(result.error)).toEqual({
      email: "Ingresa tu email",
      password: "Ingresa tu contraseña",
    });
  });
});

describe("profileSchema", () => {
  it("trims and validates the name", () => {
    expect(profileSchema.parse({ name: "  Lu  " })).toEqual({ name: "Lu" });
    expect(profileSchema.safeParse({ name: " " }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const input = { currentPassword: "vieja-clave-1", newPassword: "nueva-clave-2", confirmPassword: "nueva-clave-2" };

  it("accepts a new, confirmed password", () => {
    expect(changePasswordSchema.safeParse(input).success).toBe(true);
  });

  it("requires the confirmation to match and the new password to differ", () => {
    const mismatch = changePasswordSchema.safeParse({ ...input, confirmPassword: "otra" });
    expect(mismatch.success ? {} : fieldErrors(mismatch.error)).toEqual({ confirmPassword: "Las contraseñas no coinciden" });
    const same = changePasswordSchema.safeParse({ ...input, newPassword: input.currentPassword, confirmPassword: input.currentPassword });
    expect(same.success ? {} : fieldErrors(same.error)).toEqual({
      newPassword: "La nueva contraseña tiene que ser distinta de la actual",
    });
  });
});
