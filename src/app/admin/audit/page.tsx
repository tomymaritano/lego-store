import type { Metadata } from "next";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { AUDIT_ENTITY_LABELS, auditActionLabel, auditEntityHref, describeAuditChanges } from "@/lib/admin/audit-format";
import { getAdminAuditLog } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";
import { AUDIT_ENTITY_TYPES, parseAuditFilters } from "@/lib/validations/audit";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Pagination, pageHref } from "@/components/admin/Pagination";
import { Button, Card, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Auditoría · Administración",
};

const ENTITY_OPTIONS = [{ value: "", label: "Todos" }, ...AUDIT_ENTITY_TYPES.map((type) => ({ value: type, label: AUDIT_ENTITY_LABELS[type] }))];

/**
 * /admin/audit: every change an admin made (products, orders, reviews,
 * coupons, users, categories, themes, uploads), newest first. Filters by
 * admin, kind of record and dates (store calendar days) in the URL, plus one
 * record's id from a history panel's "Ver todo"; 20 per page.
 */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/audit" });
  const filters = parseAuditFilters(await searchParams);
  const page = await getAdminAuditLog(filters);
  const params = { actor: filters.actor, entity: filters.entity, entityId: filters.entityId, action: filters.action, from: filters.from, to: filters.to };
  const filtered = Object.values(params).some(Boolean);

  return (
    <>
      <PageHeader
        title="Auditoría"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Auditoría" }]}
        description="Quién cambió qué y cuándo en el panel. Cada cambio queda registrado con el admin que lo hizo."
      />

      <Card className="mb-6 p-4">
        <form
          method="get"
          role="search"
          aria-label="Filtrar la auditoría"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end"
        >
          <Field label="Admin">
            <Input
              name="actor"
              type="search"
              defaultValue={filters.actor}
              placeholder="Email del admin"
              leftIcon={<Search aria-hidden="true" className="size-4" />}
              className="h-9"
            />
          </Field>
          <FilterSelect name="entity" label="Registro" defaultValue={filters.entity} options={ENTITY_OPTIONS} />
          <Field label="Desde">
            <Input name="from" type="date" defaultValue={filters.from} className="h-9" />
          </Field>
          <Field label="Hasta">
            <Input name="to" type="date" defaultValue={filters.to} className="h-9" />
          </Field>
          {filters.entityId ? <input type="hidden" name="entityId" value={filters.entityId} /> : null}
          {filters.action ? <input type="hidden" name="action" value={filters.action} /> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {filtered ? (
              <Button render={<Link href="/admin/audit" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
        {filters.entityId ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-label font-normal text-fg-secondary">
            Solo el registro <span className="font-mono text-fg">{filters.entityId}</span>
            <Link
              href={pageHref("/admin/audit", { ...params, entityId: "" }, 1)}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-1 font-medium text-fg underline-offset-4 hover:underline"
            >
              <X aria-hidden="true" className="size-3.5" />
              Ver todos
            </Link>
          </p>
        ) : null}
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? "No hay cambios con esos filtros" : "Todavía no hay cambios registrados"}
            description={filtered ? "Prueba con otro admin, registro o fechas." : "Cuando un admin cambie algo, lo vas a ver acá."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Table label="Cambios registrados" data-testid="audit-log">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden sm:table-cell">Admin</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead className="hidden md:table-cell">Detalle</TableHead>
                <TableHead className="hidden lg:table-cell">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((entry) => {
                const href = auditEntityHref(entry.entityType, entry.entityId);
                const label = AUDIT_ENTITY_LABELS[entry.entityType as keyof typeof AUDIT_ENTITY_LABELS] ?? entry.entityType;
                const lines = describeAuditChanges(entry);
                return (
                  <TableRow key={entry.id} data-testid="audit-row">
                    <TableCell className="whitespace-nowrap text-fg-secondary">{formatAdminDateTime(entry.at)}</TableCell>
                    <TableCell className="hidden max-w-56 sm:table-cell">
                      <span className="block truncate">{entry.actorEmail}</span>
                    </TableCell>
                    <TableCell className="min-w-48">
                      <span className="block font-medium text-fg">{auditActionLabel(entry.action)}</span>
                      {/* On a phone the Admin column is hidden: who did it goes under the action. */}
                      <span className="block truncate text-caption text-fg-secondary sm:hidden">{entry.actorEmail}</span>
                      <span className="block text-caption text-fg-muted">
                        {label}{" "}
                        {href ? (
                          <Link href={href} prefetch={false} className="font-mono underline-offset-4 hover:text-fg hover:underline">
                            {entry.entityId}
                          </Link>
                        ) : (
                          <span className="font-mono">{entry.entityId}</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-md text-caption text-fg-secondary md:table-cell">
                      {lines.length > 0 ? (
                        <ul className="space-y-0.5">
                          {lines.map((line, index) => (
                            <li key={index} className="break-words">
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-caption whitespace-nowrap text-fg-muted lg:table-cell">{entry.ip ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination path="/admin/audit" params={params} page={page.page} totalPages={page.totalPages} total={page.total} noun={["cambio"]} />
        </div>
      )}
    </>
  );
}
