import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { setMessageStatusAction } from "@/lib/admin/actions";
import { getAdminMessages } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";
import { MESSAGE_STATUS_LABELS } from "@/lib/contact/messages";
import { CONTACT_TOPICS } from "@/lib/validations/contact-options";
import { parseMessageFilters } from "@/lib/validations/inbox";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { MessageActions } from "@/components/admin/MessageActions";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, Button, Card, EmptyState, Field, Input } from "@/components/ui";

export const metadata: Metadata = {
  title: "Mensajes · Administración",
};

const VIEW_OPTIONS = [
  { value: "inbox", label: "Bandeja (sin archivar)" },
  { value: "NEW", label: "Nuevos" },
  { value: "READ", label: "Leídos" },
  { value: "ARCHIVED", label: "Archivados" },
  { value: "all", label: "Todos" },
];

const TOPIC_OPTIONS = [{ value: "", label: "Todos" }, ...CONTACT_TOPICS.map((topic) => ({ value: topic.value, label: topic.label }))];

const topicLabel = (value: string) => CONTACT_TOPICS.find((topic) => topic.value === value)?.label ?? value;

const STATUS_BADGE = { NEW: "warning", READ: "neutral", ARCHIVED: "neutral" } as const;

/**
 * /admin/mensajes: what people wrote from /contacto, newest first. Filter by
 * view (the inbox hides archived ones), topic, text and dates in the URL (a
 * plain GET form); each message opens its page, and the row's buttons mark
 * it read or archive it.
 */
export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/mensajes" });
  const filters = parseMessageFilters(await searchParams);
  const page = await getAdminMessages(filters);
  const params = { view: filters.view === "inbox" ? "" : filters.view, q: filters.q, topic: filters.topic, from: filters.from, to: filters.to };
  const filtered = Object.values(params).some(Boolean);

  return (
    <>
      <PageHeader
        title="Mensajes"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Mensajes" }]}
        description={page.unread > 0 ? `${pluralize(page.unread, "mensaje nuevo", "mensajes nuevos")} sin leer.` : "No hay mensajes sin leer."}
      />

      <Card className="mb-6 p-4">
        <form
          method="get"
          role="search"
          aria-label="Filtrar mensajes"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end"
        >
          <Field label="Buscar">
            <Input name="q" type="search" defaultValue={filters.q} placeholder="Nombre, email, pedido o texto" leftIcon={<Search aria-hidden="true" className="size-4" />} className="h-9" />
          </Field>
          <FilterSelect name="view" label="Mostrar" defaultValue={filters.view} options={VIEW_OPTIONS} />
          <FilterSelect name="topic" label="Motivo" defaultValue={filters.topic} options={TOPIC_OPTIONS} />
          <Field label="Desde">
            <Input name="from" type="date" defaultValue={filters.from} className="h-9" />
          </Field>
          <Field label="Hasta">
            <Input name="to" type="date" defaultValue={filters.to} className="h-9" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {filtered ? (
              <Button render={<Link href="/admin/mensajes" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? "No hay mensajes con esos filtros" : "La bandeja está vacía"}
            description={filtered ? "Prueba con otra búsqueda o limpia los filtros." : "Cuando alguien escriba desde la página de contacto, lo vas a ver acá."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface" data-testid="admin-messages">
            {page.items.map((message) => (
              <li
                key={message.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start data-[status=NEW]:bg-row-highlight"
                data-status={message.status}
                data-testid="admin-message-row"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/mensajes/${message.id}`}
                      prefetch={false}
                      className="font-semibold text-fg underline-offset-4 hover:underline data-[new=true]:font-bold"
                    >
                      {message.name}
                    </Link>
                    <span className="truncate text-label text-fg-muted">{message.email}</span>
                    <Badge variant={STATUS_BADGE[message.status]}>{MESSAGE_STATUS_LABELS[message.status]}</Badge>
                  </p>
                  <p className="mt-1 text-label font-medium text-fg-secondary">
                    {topicLabel(message.topic)}
                    {message.orderNumber ? ` · ${message.orderNumber}` : ""} · <span className="whitespace-nowrap">{formatAdminDateTime(message.createdAt)}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-label font-normal text-fg-secondary">{message.message}</p>
                </div>
                <MessageActions action={setMessageStatusAction.bind(null, message.id)} status={message.status} subject={`el mensaje de ${message.name}`} />
              </li>
            ))}
          </ul>
          <Pagination path="/admin/mensajes" params={params} page={page.page} totalPages={page.totalPages} total={page.total} noun={["mensaje"]} />
        </div>
      )}
    </>
  );
}
