import { z } from "zod";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, isPasswordTooLong } from "@/lib/auth/password-rules";
import { normalizeEmail } from "@/lib/auth/email";

/*
 * Account forms (login, registration, profile, password change). Parsed on
 * the server by the Server Actions; messages are what the forms show.
 * Emails come out normalised (trimmed, lowercased), as the database stores them.
 */

export const NAME_MAX = 80;
/** RFC 5321's practical limit for an address. */
export const EMAIL_MAX = 254;

const email = z
  .string({ error: "Ingresa tu email" })
  .trim()
  .min(1, "Ingresa tu email")
  .max(EMAIL_MAX, "El email es demasiado largo")
  .pipe(z.email("Ingresa un email válido"))
  .transform(normalizeEmail);

const name = z
  .string({ error: "Ingresa tu nombre" })
  .trim()
  .min(2, "Ingresa tu nombre (al menos 2 caracteres)")
  .max(NAME_MAX, `El nombre no puede superar ${NAME_MAX} caracteres`);

/** A new password: length rules only (no composition rules, as NIST recommends). */
const newPassword = z
  .string({ error: "Ingresa una contraseña" })
  .min(1, "Ingresa una contraseña")
  .min(MIN_PASSWORD_LENGTH, `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .refine((value) => !isPasswordTooLong(value), {
    message: `La contraseña es demasiado larga (máximo ${MAX_PASSWORD_BYTES} bytes; las letras con tilde y los emojis ocupan más de uno)`,
  });

/** A password being checked (login, current password): only presence; the hash decides. */
const existingPassword = (message: string) => z.string({ error: message }).min(1, message);

export const loginSchema = z.object({
  email,
  password: existingPassword("Ingresa tu contraseña"),
});

export const registerSchema = z
  .object({
    name,
    email,
    password: newPassword,
    confirmPassword: z.string({ error: "Repite la contraseña" }).min(1, "Repite la contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

export const profileSchema = z.object({ name });

export const changePasswordSchema = z
  .object({
    currentPassword: existingPassword("Ingresa tu contraseña actual"),
    newPassword,
    confirmPassword: z.string({ error: "Repite la nueva contraseña" }).min(1, "Repite la nueva contraseña"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "La nueva contraseña tiene que ser distinta de la actual",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The first message per field, for a form's field errors. */
export function fieldErrors<T extends string>(error: z.ZodError): Partial<Record<T, string>> {
  const errors: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) errors[key as T] = issue.message;
  }
  return errors;
}
