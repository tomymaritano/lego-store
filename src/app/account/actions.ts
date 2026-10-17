"use server";

import { redirect } from "next/navigation";
import { renewSession, updateSession } from "@/lib/auth";
import { changeUserPassword, updateUserName } from "@/lib/auth/accounts";
import { sessionRenewal } from "@/lib/auth/session-token";
import { formText, type FormState } from "@/lib/auth/form-state";
import { requireUser } from "@/lib/auth/session";
import { waitMessage } from "@/lib/rate-limit";
import { changePasswordSchema, fieldErrors, profileSchema } from "@/lib/validations/auth";

/*
 * /account Server Actions. Each one checks the session itself (requireUser):
 * Server Actions are POST endpoints of their own, whatever proxy.ts matches.
 */

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

/** /account?password-changed=1: the password was just changed. */
const PASSWORD_CHANGED_PARAM = "password-changed";

export async function updateProfileAction(_previous: FormState<"name">, formData: FormData): Promise<FormState<"name">> {
  const user = await requireUser();
  const values = { name: formText(formData, "name") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors<"name">(parsed.error), values };

  await updateUserName(user.id, parsed.data.name);
  // Re-issues the session cookie with the new name; Next re-renders the page (and the navbar) with it.
  await updateSession({});
  return { status: "success", message: "Guardamos tu nombre.", values: { name: parsed.data.name } };
}

export async function changePasswordAction(
  _previous: FormState<PasswordField>,
  formData: FormData
): Promise<FormState<PasswordField>> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formText(formData, "currentPassword"),
    newPassword: formText(formData, "newPassword"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors<PasswordField>(parsed.error) };

  const result = await changeUserPassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  if (!result.ok) {
    switch (result.reason) {
      case "wrong_password":
        return { status: "error", fieldErrors: { currentPassword: "La contraseña actual no es correcta" } };
      case "no_password":
        return { status: "error", message: "Tu cuenta ingresa con Google y no tiene contraseña." };
      case "conflict":
        return { status: "error", message: "Tu contraseña cambió desde otro lugar mientras tanto. Recarga la página e inténtalo de nuevo." };
      case "rate_limited":
        return {
          status: "error",
          message: `Demasiados intentos. Vuelve a intentarlo en ${waitMessage(result.retryAfterSeconds)}.`,
        };
    }
  }

  // The password change bumped the session version: renew this session's token so it stays
  // signed in. Only a renewal made here can move a token to the new version (session-token.ts).
  const renewal = sessionRenewal(user.id, result.sessionVersion.from, result.sessionVersion.to);
  if (renewal) await renewSession(renewal);
  // Redirect (post/redirect/get) instead of returning a state: re-rendering this request would
  // still read the old token from the request headers (Auth.js reads headers(), not the cookie
  // just set) and treat this session as signed out. The page shows the confirmation.
  redirect(`/account?${PASSWORD_CHANGED_PARAM}=1`);
}
