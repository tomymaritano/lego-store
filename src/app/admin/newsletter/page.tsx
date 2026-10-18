import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { unsubscribeSubscriberAction } from "@/lib/admin/actions";
import { getAdminSubscribers } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";
import { parseSubscriberFilters } from "@/lib/validations/inbox";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Pagination } from "@/components/admin/Pagination";
import { ExportButton } from "@/components/admin/ExportButton";
import { UnsubscribeSubscriber } from "@/components/admin/UnsubscribeSubscriber";
import { Badge, Button, Card, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Newsletter · Administración",
};

const SOURCE_LABELS: Record<string, string> = { footer: "Pie de página", home: "Inicio", checkout: "Checkout" };

/**
 * /admin/newsletter: who signed up, newest first, with who left and when.
 * Search by email and status in the URL (a plain GET form). "Dar de baja"
 * unsubscribes someone who asked another way (audited); the export carries
 * each active subscriber's own unsubscribe link for the mailing tool.
 */
export default async function AdminNewsletterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/newsletter" });
  const filters = parseSubscriberFilters(await searchParams);
  const page = await getAdminSubscribers(filters);
  const params = { q: filters.q, status: filters.status };
  const filtered = Object.values(params).some(Boolean);

  return (
    <>
      <PageHeader
        title="Newsletter"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Newsletter" }]}
        description={`${pluralize(page.active, "suscriptor activo", "suscriptores activos")}.`}
        actions={<ExportButton kind="newsletter" params={params} />}
      />

      <Card className="mb-6 p-4">
        <form method="get" role="search" aria-label="Filtrar suscriptores" className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Buscar">
            <Input name="q" type="search" defaultValue={filters.q} placeholder="Email" leftIcon={<Search aria-hidden="true" className="size-4" />} className="h-9" />
          </Field>
          <FilterSelect
            name="status"
            label="Estado"
            defaultValue={filters.status}
            options={[
              { value: "", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "unsubscribed", label: "Dados de baja" },
            ]}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {filtered ? (
              <Button render={<Link href="/admin/newsletter" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? "No hay suscriptores con esos filtros" : "Todavía no hay suscriptores"}
            description={filtered ? "Prueba con otra búsqueda o limpia los filtros." : "Cuando alguien se suscriba desde el pie de página, lo vas a ver acá."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Table label="Suscriptores del newsletter" data-testid="admin-subscribers">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden sm:table-cell">Origen</TableHead>
                <TableHead className="hidden md:table-cell">Alta</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((subscriber) => (
                <TableRow key={subscriber.id} data-testid="admin-subscriber-row">
                  <TableCell
                    id={`subscriber-${subscriber.id}`}
                    tabIndex={-1}
                    className="max-w-72 truncate font-medium text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
                  >
                    {subscriber.email}
                  </TableCell>
                  <TableCell>
                    {subscriber.unsubscribedAt ? (
                      <span className="flex flex-col gap-0.5">
                        <Badge className="w-fit">De baja</Badge>
                        <span className="text-caption whitespace-nowrap text-fg-muted">{formatAdminDateTime(subscriber.unsubscribedAt)}</span>
                      </span>
                    ) : (
                      <Badge variant="success">Activo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-fg-secondary sm:table-cell">{SOURCE_LABELS[subscriber.source] ?? subscriber.source}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-fg-secondary md:table-cell">{formatAdminDateTime(subscriber.subscribedAt)}</TableCell>
                  <TableCell className="text-right">
                    {subscriber.unsubscribedAt ? null : (
                      <UnsubscribeSubscriber action={unsubscribeSubscriberAction.bind(null, subscriber.id)} email={subscriber.email} focusId={`subscriber-${subscriber.id}`} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination path="/admin/newsletter" params={params} page={page.page} totalPages={page.totalPages} total={page.total} noun={["suscriptor", "suscriptores"]} />
        </div>
      )}
    </>
  );
}
