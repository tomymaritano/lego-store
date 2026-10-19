import { z } from "zod";
import { dateParam, first, pageOf, textParam, type SearchParams } from "./admin";
import { idSchema } from "./ids";

/*
 * Inputs of the admin's users section (/admin/users): the list's search
 * params and the role / block actions.
 */

export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUS_FILTERS = ["active", "blocked"] as const;

export interface AdminUserFilters {
  /** Part of the name or email, or the exact id. */
  q: string;
  role: UserRole | "";
  status: (typeof USER_STATUS_FILTERS)[number] | "";
  /** Sign-up dates (store calendar days), inclusive (YYYY-MM-DD). */
  from: string;
  to: string;
  page: number;
}

export function parseUserFilters(params: SearchParams): AdminUserFilters {
  const role = first(params.role);
  const status = first(params.status);
  return {
    q: textParam(first(params.q), 254),
    role: (USER_ROLES as readonly string[]).includes(role) ? (role as UserRole) : "",
    status: (USER_STATUS_FILTERS as readonly string[]).includes(status) ? (status as AdminUserFilters["status"]) : "",
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
    page: pageOf(first(params.page)),
  };
}

export const MAX_BLOCK_REASON = 300;

export const userRoleSchema = z.object({ userId: idSchema, role: z.enum(USER_ROLES) });

export const userBlockSchema = z.object({
  userId: idSchema,
  blocked: z.boolean(),
  /** The admin's note (optional): only kept when blocking. */
  reason: z
    .string()
    .trim()
    .max(MAX_BLOCK_REASON, `Como máximo ${MAX_BLOCK_REASON} caracteres`)
    .optional()
    .transform((value) => (value ? value : null)),
});
