import { dateParam, first, pageOf, textParam, type SearchParams } from "./admin";

/*
 * Filters of /admin/audit (search params). Anything invalid falls back to
 * "no filter", like the other admin lists.
 */

/** What an audit entry can be about (AuditLog.entityType). */
export const AUDIT_ENTITY_TYPES = ["product", "order", "review", "coupon", "user", "category", "theme", "upload"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export interface AuditFilters {
  /** Part of the admin's email. */
  actor: string;
  entity: AuditEntityType | "";
  /** One record's id (the "Ver todo" link of a history panel). */
  entityId: string;
  /** An action or its prefix ("user.", "product.update"). */
  action: string;
  /** Store-time calendar dates, inclusive (YYYY-MM-DD). */
  from: string;
  to: string;
  page: number;
}

export function parseAuditFilters(params: SearchParams): AuditFilters {
  const entity = first(params.entity);
  const action = textParam(first(params.action), 64);
  return {
    actor: textParam(first(params.actor), 254),
    entity: (AUDIT_ENTITY_TYPES as readonly string[]).includes(entity) ? (entity as AuditFilters["entity"]) : "",
    entityId: textParam(first(params.entityId), 64),
    action: /^[a-z_.]*$/.test(action) ? action : "",
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
    page: pageOf(first(params.page)),
  };
}
