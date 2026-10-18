"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CHECKOUT_COOKIE } from "@/lib/orders/access";
import { isGoogleEnabled, signIn, signOut } from "./index";
import { revokeAllSessions } from "./accounts";
import { getCurrentUser } from "./session";
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
 * Signs this browser out (deletes its session cookie, and the checkout's:
 * the next person at this browser does not inherit the last checkout).
 * A customer's other devices stay signed in. An admin's logout ends every
 * admin session (a copied admin cookie must not outlive the logout); for a
 * customer that is logoutEverywhereAction (README, "Sesiones").
 */
export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") await revokeAllSessions(user.id);
  (await cookies()).delete(CHECKOUT_COOKIE);
  await signOut({ redirectTo: "/" });
}

/**
 * "Cerrar sesión en todos los dispositivos": revokes every session of the
 * account server side (a cookie copied before still stops working), then
 * signs this browser out.
 */
export async function logoutEverywhereAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await revokeAllSessions(user.id);
  (await cookies()).delete(CHECKOUT_COOKIE);
  await signOut({ redirectTo: "/" });
}
