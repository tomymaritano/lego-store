import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminOrders } from "@/lib/admin/data";
import { ORDER_STATUS_LABELS } from "@/lib/orders/format";
import { ORDER_STATUSES, parseOrderFilters } from "@/lib/validations/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { Pagination } from "@/components/admin/Pagination";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pedidos · Administración",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
  { value: "amount_mismatch", label: "Cancelados: monto distinto" },
  { value: "draft", label: "Sin intento de pago" },
];

/**
 * /admin/orders: placed orders ("Realizar pedido"), the last placed first, as
 * the dashboard counts them; checkouts that never got there only under the
 * "Sin intento de pago" filter. Filters by status (and the cancellations for
 * a charge that did not match the total), email or order number, and the
 * date it was placed (store calendar days), in the URL; 20 per page.
 */
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/orders" });
  const filters = parseOrderFilters(await searchParams);
  const page = await getAdminOrders(filters);
  const filtered = Boolean(filters.status || filters.q || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Pedidos"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Pedidos" }]}
        description="Envía, entrega o cancela pedidos. Cancelar uno pagado lo reembolsa en Stripe y devuelve el stock."
      />

      <Card className="mb-6 p-4">
        <form
          method="get"
          role="search"
          aria-label="Filtrar pedidos"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end"
        >
          <Field label="Email o número">
            <Input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="ana@ejemplo.com, LEGO-001001"
              leftIcon={<Search aria-hidden="true" className="size-4" />}
              className="h-9"
            />
          </Field>
          <FilterSelect name="status" label="Estado" defaultValue={filters.status} options={STATUS_OPTIONS} />
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
              <Button render={<Link href="/admin/orders" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? "No hay pedidos con esos filtros" : "Todavía no hay pedidos"}
            description={filtered ? "Prueba con otro estado o fechas." : "Cuando alguien compre, lo vas a ver acá."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <OrdersTable orders={page.items} label="Pedidos" />
          <Pagination
            path="/admin/orders"
            params={{ q: filters.q, status: filters.status, from: filters.from, to: filters.to }}
            page={page.page}
            totalPages={page.totalPages}
            total={page.total}
            noun={["pedido"]}
          />
        </div>
      )}
    </>
  );
}
