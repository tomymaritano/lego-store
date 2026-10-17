"use server";

import { redirect } from "next/navigation";
import { isGoogleEnabled, signIn, signOut } from "./index";
import { safeCallbackUrl } from "./callback-url";
import { formText } from "./form-state";

/*
 * Auth Server Actions shared across the app: the navbar (desktop and phone
 * menus), /account, /login and /register all use them, so they live with the
 * auth code rather than in a route group.
 */

export async function googleSignInAction(formData: FormData): Promise<void> {
  if (!isGoogleEnabled()) redirect("/login");
  await signIn("google", { redirectTo: safeCallbackUrl(formText(formData, "callbackUrl")) });
}

/**
 * Signs this browser out (deletes its session cookie). Other devices stay
 * signed in; changing the password is what ends every session (README,
 * "Sesiones").
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
