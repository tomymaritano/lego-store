import bcrypt from "bcryptjs";

/*
 * Password hashing (bcrypt, pure JS: no native build on Windows or Vercel).
 * Used by registration/login and by the seed for the admin user.
 *
 * bcrypt only reads the first 72 bytes of its input and silently ignores the
 * rest, so two long passwords sharing those bytes would verify as equal.
 * Longer passwords are therefore rejected (hashPassword throws, verifyPassword
 * says no); registration validates MAX_PASSWORD_BYTES up front with
 * isPasswordTooLong so the user gets a message instead.
 */

const COST = 12;

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt's input limit, in UTF-8 bytes ("ñ" or an emoji count as more than one). */
export const MAX_PASSWORD_BYTES = 72;

export function isPasswordTooLong(password: string): boolean {
  return new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
}

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
