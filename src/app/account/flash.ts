import "server-only";

import { cookies } from "next/headers";

/*
 * "Your password was changed" is a one-time flash, not a URL: a query
 * parameter could be put in a link by anyone, and would show the message on
 * every reload. The action sets an HttpOnly cookie for /account naming the
 * user; the page shows the notice only to that user; the form clears it as
 * soon as it has shown it (dismissPasswordNoticeAction), so a reload does not
 * show it again. The short max-age covers a page that never got to clear it.
 */

const COOKIE = "password-changed";

export async function setPasswordChangedFlash(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/account",
    maxAge: 60,
  });
}

export async function hasPasswordChangedFlash(userId: string): Promise<boolean> {
  return (await cookies()).get(COOKIE)?.value === userId;
}

export async function clearPasswordChangedFlash(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/account" });
}
