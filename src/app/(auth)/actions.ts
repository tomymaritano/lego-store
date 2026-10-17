"use server";

import { headers } from "next/headers";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth";
import { registerUser } from "@/lib/auth/accounts";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { formText, type FormState } from "@/lib/auth/form-state";
import { clientIp, rateLimits, waitMessage } from "@/lib/rate-limit";
import { fieldErrors, loginSchema, registerSchema, type LoginField, type RegisterField } from "@/lib/validations/auth";

/*
 * Login and registration (logout and the Google button, which the navbar and
 * /account use too, live in src/lib/auth/actions.ts). Each one validates on the server (zod),
 * whatever the form did, and only redirects to a same-site callbackUrl.
 * Login rate limits live in the Credentials provider (lib/auth/accounts.ts),
 * so they also cover direct POSTs to /api/auth/callback/credentials.
 */

const LOGIN_FAILED = "El email o la contraseña no son correctos.";
const TOO_MANY_LOGINS = "Demasiados intentos de ingreso. Espera unos minutos y vuelve a intentarlo.";
const UNAVAILABLE = "No pudimos iniciar sesión. Vuelve a intentarlo en unos minutos.";

/** Runs signIn("credentials"), turning its errors into a form message. Success redirects (throws). */
async function signInWithPassword(email: string, password: string, redirectTo: string): Promise<string> {
  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error; // the success redirect, or a real failure
    if (error instanceof CredentialsSignin) return error.code === "rate_limited" ? TOO_MANY_LOGINS : LOGIN_FAILED;
    console.error("[auth] login failed:", error);
    return UNAVAILABLE;
  }
  return UNAVAILABLE;
}

export async function loginAction(_previous: FormState<LoginField>, formData: FormData): Promise<FormState<LoginField>> {
  const values = { email: formText(formData, "email") };
  const parsed = loginSchema.safeParse({ email: values.email, password: formText(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors<LoginField>(parsed.error), values };

  const redirectTo = safeCallbackUrl(formText(formData, "callbackUrl"));
  const message = await signInWithPassword(parsed.data.email, parsed.data.password, redirectTo);
  return { status: "error", message, values };
}

export async function registerAction(
  _previous: FormState<RegisterField>,
  formData: FormData
): Promise<FormState<RegisterField>> {
  const values = { name: formText(formData, "name"), email: formText(formData, "email") };
  const parsed = registerSchema.safeParse({
    ...values,
    password: formText(formData, "password"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors<RegisterField>(parsed.error), values };

  const limit = await rateLimits.registerIp.consume(clientIp(await headers()));
  if (!limit.ok) {
    return {
      status: "error",
      message: `Se crearon demasiadas cuentas desde tu conexión. Vuelve a intentarlo en ${waitMessage(limit.retryAfterSeconds)}.`,
      values,
    };
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: { email: "Ya existe una cuenta con ese email. Inicia sesión o usa otro email." },
      values,
    };
  }

  const redirectTo = safeCallbackUrl(formText(formData, "callbackUrl"));
  await signInWithPassword(parsed.data.email, parsed.data.password, redirectTo);
  // Only reached when that automatic login failed: the account exists, so send them to log in.
  return {
    status: "error",
    message: "Creamos tu cuenta, pero no pudimos iniciar tu sesión. Ingresa con tu email y contraseña.",
    values,
  };
}
