import type { Role } from "@/generated/prisma/enums";

/**
 * The one spelling of an email the database keeps (User and Order have a
 * CHECK that emails are lowercase): trimmed and lowercased. Every write and
 * lookup goes through this, so "Ana@Mail.com" and "ana@mail.com" are one account.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Role for an email: ADMIN when it is ADMIN_EMAIL (compared normalised), USER
 * otherwise. The OAuth adapter uses it for addresses Google verified; password
 * registration uses it only to refuse ADMIN_EMAIL (registerUser), since only
 * the seed creates that account.
 */
export function roleForEmail(email: string, adminEmail: string | undefined = process.env.ADMIN_EMAIL): Role {
  const admin = adminEmail?.trim() ? normalizeEmail(adminEmail) : null;
  return admin !== null && normalizeEmail(email) === admin ? "ADMIN" : "USER";
}
