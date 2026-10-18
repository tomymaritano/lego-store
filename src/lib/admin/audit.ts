import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/lib/lists/product";

/*
 * The admin's audit log (AuditLog): who did what to which record, and when.
 * Every admin mutation writes its entry in the same transaction as the
 * change, so there is never a change without its entry (or the other way
 * around). Order status changes keep their own trail (OrderStatusChange).
 */

export interface AuditActor {
  id: string;
  email: string;
}

type JsonValue = string | number | boolean | null;

/** { field: [before, after] } for the fields that changed (dates as ISO strings). */
export type AuditChanges = Record<string, [JsonValue, JsonValue] | JsonValue>;

const plain = (value: unknown): JsonValue =>
  value instanceof Date ? value.toISOString() : value === undefined ? null : (value as JsonValue);

/** The fields of `after` whose value differs from `before`'s, as [before, after]. */
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): AuditChanges {
  const changes: AuditChanges = {};
  for (const key of Object.keys(after)) {
    const from = plain(before[key]);
    const to = plain(after[key]);
    if (from !== to) changes[key] = [from, to];
  }
  return changes;
}

/** The values of a record as an entry's `changes` (a creation). */
export function snapshotFields(values: Record<string, unknown>): AuditChanges {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, plain(value)]));
}

export async function recordAudit(
  db: Db,
  actor: AuditActor,
  entry: { action: string; entityType: string; entityId: string; changes?: AuditChanges | null }
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email.trim().toLowerCase(),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export interface AuditEntryView {
  id: string;
  action: string;
  actorEmail: string;
  changes: AuditChanges | null;
  at: string;
}

/** A record's entries, newest first. */
export async function listAuditEntries(db: Db, entityType: string, entityId: string, take = 50): Promise<AuditEntryView[]> {
  const rows = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, action: true, actorEmail: true, changes: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorEmail: row.actorEmail,
    changes: (row.changes as AuditChanges | null) ?? null,
    at: row.createdAt.toISOString(),
  }));
}
