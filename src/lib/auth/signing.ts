import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Short server-made values the client may carry but cannot forge or alter:
 * an HMAC-SHA256 over a purpose and a payload, keyed with AUTH_SECRET. Each
 * purpose ("session-renewal", "known-device") signs differently, so a value
 * made for one is worthless for another.
 */

function secret(env: NodeJS.ProcessEnv): string | null {
  return env.AUTH_SECRET?.trim() || null;
}

function mac(purpose: string, payload: string, key: string): string {
  return createHmac("sha256", key).update(`${purpose}\n${payload}`).digest("base64url");
}

/** The signature of `payload` for `purpose`, or null without AUTH_SECRET (then nothing can be verified either). */
export function signPayload(purpose: string, payload: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const key = secret(env);
  return key ? mac(purpose, payload, key) : null;
}

/** Whether `signature` is the one signPayload() makes for this purpose and payload (constant time). */
export function verifyPayload(purpose: string, payload: string, signature: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = signPayload(purpose, payload, env);
  if (!expected || typeof signature !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
