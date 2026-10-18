import Link from "next/link";
import { auditActionLabel, describeAuditChanges } from "@/lib/admin/audit-format";
import { AUDIT_PANEL_SIZE, type AuditEntryView } from "@/lib/admin/audit";
import { formatAdminDateTime } from "@/lib/admin/format";
import { pageHref } from "./Pagination";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

/** One title and one empty text for every record's history (the order page's timeline uses them too). */
export const AUDIT_HISTORY_TITLE = "Historial";
export const AUDIT_HISTORY_EMPTY = "Sin cambios registrados.";

interface AuditHistoryProps {
  entries: AuditEntryView[];
  /** The record the entries are about: the "Ver todo" link filters /admin/audit by it. */
  entity: { type: string; id: string };
  title?: string;
  /** Where "Ver todo" goes, when not the log filtered by the record (an admin's own actions). */
  allHref?: string;
  /** Shown when there are no entries. */
  empty?: string;
  className?: string;
}

/**
 * A record's audit trail beside its admin page (product, coupon, user,
 * category, theme, settings, content, message): who changed what and when,
 * the latest AUDIT_PANEL_SIZE entries, newest first, with a link to the whole
 * log filtered by the record. The data layer reads one entry more than it
 * shows (listAuditEntries), so the panel knows when there are older ones.
 */
export function AuditHistory({ entries: all, entity, title = AUDIT_HISTORY_TITLE, allHref, empty = AUDIT_HISTORY_EMPTY, className }: AuditHistoryProps) {
  const headingId = `audit-history-${entity.type}-${allHref ? "actor" : "record"}`;
  const entries = all.slice(0, AUDIT_PANEL_SIZE);
  const older = all.length > entries.length;
  return (
    <Card className={cn("self-start", className)}>
      <CardHeader className="flex-row items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-title text-fg">
          {title}
        </h2>
        {entries.length > 0 ? (
          <Link
            href={allHref ?? pageHref("/admin/audit", { entity: entity.type, entityId: entity.id }, 1)}
            prefetch={false}
            className="text-label font-medium text-fg-secondary underline-offset-4 hover:text-fg hover:underline"
          >
            Ver todo<span className="sr-only"> en la auditoría</span>
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-label font-normal text-fg-muted">{empty}</p>
        ) : (
          <ol aria-labelledby={headingId} className="space-y-3 text-label font-normal" data-testid="audit-history">
            {entries.map((entry) => {
              const lines = describeAuditChanges(entry);
              return (
                <li key={entry.id} className="border-l-2 border-border pl-3" data-testid="audit-history-entry">
                  <span className="font-medium text-fg">{auditActionLabel(entry.action)}</span>
                  <span className="block text-caption text-fg-muted">
                    {entry.actorEmail} · {formatAdminDateTime(entry.at)}
                  </span>
                  {lines.length > 0 ? (
                    <span className="block text-caption break-words text-fg-secondary">{lines.join("; ")}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        {older ? (
          <p className="mt-3 text-caption text-fg-muted" data-testid="audit-history-more">
            Mostramos los {AUDIT_PANEL_SIZE} cambios más recientes: el resto está en &quot;Ver todo&quot;.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
