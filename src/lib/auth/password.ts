import bcrypt from "bcryptjs";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, isPasswordTooLong } from "./password-rules";

/*
 * Password hashing (bcrypt, pure JS: no native build on Windows or Vercel).
 * Used by registration/login and by the seed for the admin user. The length
 * rules live in ./password-rules.ts (no bcrypt, safe for any bundle).
 *
 * bcrypt only reads the first 72 bytes of its input and silently ignores the
 * rest, so two long passwords sharing those bytes would verify as equal.
 * Longer passwords are therefore rejected (hashPassword throws, verifyPassword
 * says no); registration validates MAX_PASSWORD_BYTES up front with
 * isPasswordTooLong so the user gets a message instead.
 */

const COST = 12;

export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES, isPasswordTooLong };

export function hashPassword(password: string): Promise<string> {
  if (isPasswordTooLong(password)) {
    return Promise.reject(new Error(`La contraseña no puede superar los ${MAX_PASSWORD_BYTES} bytes.`));
  }
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Never true for input bcrypt would truncate: such a password was never hashed.
  if (isPasswordTooLong(password)) return false;
  return bcrypt.compare(password, hash);
}
