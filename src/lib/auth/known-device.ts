import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeEmail } from "./email";
import { signPayload, verifyPayload } from "./signing";

/*
 * "Known device" cookies, so failed guesses by someone else cannot lock an
 * account's owner out (the OWASP "device cookie" approach).
 *
 * After a successful password login the browser gets an HttpOnly cookie with
 * a random device id, signed together with the account's email. Logins that
 * present it for that email are rate limited per device instead of per IP
 * and skip the account-wide limit (see verifyCredentials): a stranger
 * guessing passwords fills only the counters of unknown devices, and cannot
 * make such a cookie without having logged in, that is, without the password.
 *
 * One cookie per browser: logging in to another account replaces it.
 */

export const KNOWN_DEVICE_COOKIE = "known-device";
const PURPOSE = "known-device";
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;

const payload = (deviceId: string, email: string) => `${deviceId}|${normalizeEmail(email)}`;

function readCookie(header: string | null, name: string): string | null {
  for (const part of header?.split(";") ?? []) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

/** The cookie value proving this device logged in to `email`; null without AUTH_SECRET. */
export function knownDeviceValue(email: string, deviceId: string = randomBytes(18).toString("base64url")): string | null {
  const signature = signPayload(PURPOSE, payload(deviceId, email));
  return signature ? `${deviceId}.${signature}` : null;
}

/** The device id when the request proves a past successful login to `email` from this browser, else null. */
export function readKnownDevice(headers: Pick<Headers, "get">, email: string): string | null {
  const value = readCookie(headers.get("cookie"), KNOWN_DEVICE_COOKIE);
  const [deviceId, signature] = value?.split(".") ?? [];
  if (!deviceId || !DEVICE_ID.test(deviceId)) return null;
  return verifyPayload(PURPOSE, payload(deviceId, email), signature) ? deviceId : null;
}

/** Marks this browser as a known device for `email` (call after a successful login, inside the request). */
export async function rememberKnownDevice(email: string): Promise<void> {
  const value = knownDeviceValue(email);
  if (!value) return;
  try {
    (await cookies()).set(KNOWN_DEVICE_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  } catch (error) {
    // Only a convenience against lockouts: never fail a login over it.
    console.error("[auth] could not set the known-device cookie:", error);
  }
}
