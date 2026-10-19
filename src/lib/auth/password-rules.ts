/*
 * Password rules shared by the validation schemas and the hashing module.
 * No bcrypt here, so forms and schemas can import it anywhere.
 *
 * bcrypt only reads the first 72 bytes of its input (UTF-8: "ñ" or an emoji
 * count as more than one), so longer passwords are rejected outright rather
 * than silently truncated.
 */

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt's input limit, in UTF-8 bytes. */
export const MAX_PASSWORD_BYTES = 72;

export function isPasswordTooLong(password: string): boolean {
  return new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
}
