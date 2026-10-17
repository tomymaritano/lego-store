import bcrypt from "bcryptjs";

/*
 * Password hashing (bcrypt, pure JS: no native build on Windows or Vercel).
 * Used by registration/login and by the seed for the admin user.
 */

const COST = 12;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
