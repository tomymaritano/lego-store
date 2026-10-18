import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Search, TicketPercent } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { setCouponActiveAction } from "@/lib/admin/actions";
import { getAdminCoupons } from "@/lib/admin/data";
import { COUPON_STATUS_BADGE, COUPON_STATUS_LABELS, couponWindowLabel } from "@/lib/admin/format";
import { COUPON_STATUS_FILTERS, parseCouponFilters } from "@/lib/validations/coupons";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, Button, Card, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cupones · Administración",
};

const STATUS_OPTIONS = [{ value: "", label: "Todos" }, ...COUPON_STATUS_FILTERS.map((status) => ({ value: status, label: COUPON_STATUS_LABELS[status] }))];

/**
 * /admin/coupons: every coupon, newest first, with where it stands (active,
 * scheduled, expired, used up, deactivated), its uses against its limit and
 * what it cost and brought in (discount given and sales of the paid orders
 * that used it). Search by code or note and filter by status, in the URL;
 * 20 per page. Deactivating and activating ask first.
 */
export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/coupons" });
  const filters = parseCouponFilters(await searchParams);
  const page = await getAdminCoupons(filters);
  const filtered = Boolean(filters.q || filters.status);

  return (
    <>
      <PageHeader
        title="Cupones"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Cupones" }]}
        description="Descuentos que los clientes aplican con un código en el carrito o en el checkout."
        actions={
          <Button render={<Link href="/admin/coupons/new" prefetch={false} />}>
            <Plus aria-hidden="true" />
            Nuevo cupón
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <form method="get" role="search" aria-label="Filtrar cupones" className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Buscar">
            <Input name="q" type="search" defaultValue={filters.q} placeholder="Código o nota" leftIcon={<Search aria-hidden="true" className="size-4" />} className="h-9" />
          </Field>
          <FilterSelect name="status" label="Estado" defaultValue={filters.status} options={STATUS_OPTIONS} />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {filtered ? (
              <Button render={<Link href="/admin/coupons" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TicketPercent />}
            title={filtered ? "No hay cupones con esos filtros" : "Todavía no hay cupones"}
            description={filtered ? "Prueba con otra búsqueda o limpia los filtros." : "Crea el primero: un porcentaje o un monto fijo, con las condiciones que quieras."}
            action={
              filtered ? (
                <Button render={<Link href="/admin/coupons" prefetch={false} />} variant="secondary">
                  Ver todos
                </Button>
              ) : (
                <Button render={<Link href="/admin/coupons/new" prefetch={false} />}>Nuevo cupón</Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Table label="Cupones" data-testid="admin-coupons">
            <TableHeader>
              <TableRow>
                <TableHead>Cupón</TableHead>
                <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Impacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((coupon) => (
                <TableRow key={coupon.id} data-testid="admin-coupon-row" data-coupon-code={coupon.code}>
                  <TableCell className="min-w-44">
                    <span className="flex flex-col gap-0.5">
                      <Link href={`/admin/coupons/${coupon.id}`} prefetch={false} className="font-mono font-semibold text-fg underline-offset-4 hover:underline">
                        {coupon.code}
                      </Link>
                      <span className="text-caption text-fg-secondary">
                        {coupon.label}
                        {coupon.minSubtotal > 0 ? ` · desde ${formatPrice(coupon.minSubtotal)}` : ""}
                      </span>
                      {coupon.description ? <span className="line-clamp-1 text-caption text-fg-muted">{coupon.description}</span> : null}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-fg-secondary md:table-cell">{couponWindowLabel(coupon.startsAt, coupon.expiresAt)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <span className="font-semibold" data-testid="admin-coupon-uses">
                      {coupon.uses}
                      {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
                    </span>
                    {coupon.reserved > 0 ? <span className="block text-caption text-fg-muted">{coupon.reserved} sin pagar</span> : null}
                    {coupon.maxPerUser !== null ? (
                      <span className="block text-caption text-fg-muted">{coupon.maxPerUser === 1 ? "1 por cliente" : `${coupon.maxPerUser} por cliente`}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap tabular-nums lg:table-cell">
                    <span className="block">{formatPrice(coupon.revenue)} en ventas</span>
                    <span className="block text-caption text-fg-muted">−{formatPrice(coupon.discountGiven)} de descuento</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={COUPON_STATUS_BADGE[coupon.status]} data-testid="admin-coupon-status">
                      {COUPON_STATUS_LABELS[coupon.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button render={<Link href={`/admin/coupons/${coupon.id}`} prefetch={false} />} variant="ghost" size="sm">
                        <Pencil aria-hidden="true" />
                        Editar<span className="sr-only"> {coupon.code}</span>
                      </Button>
                      {coupon.active ? (
                        <ConfirmAction
                          label={
                            <>
                              Desactivar<span className="sr-only"> {coupon.code}</span>
                            </>
                          }
                          variant="ghost"
                          title={`¿Desactivar ${coupon.code}?`}
                          description="Deja de servir en pedidos nuevos. Los pedidos que ya lo aplicaron conservan el descuento, y puedes volver a activarlo cuando quieras."
                          confirmLabel="Desactivar"
                          action={setCouponActiveAction.bind(null, coupon.id, false)}
                        />
                      ) : (
                        <ConfirmAction
                          label={
                            <>
                              Activar<span className="sr-only"> {coupon.code}</span>
                            </>
                          }
                          variant="ghost"
                          title={`¿Activar ${coupon.code}?`}
                          description="Vuelve a servir en el carrito y el checkout, con sus fechas y límites."
                          confirmLabel="Activar"
                          action={setCouponActiveAction.bind(null, coupon.id, true)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            path="/admin/coupons"
            params={{ q: filters.q, status: filters.status }}
            page={page.page}
            totalPages={page.totalPages}
            total={page.total}
            noun={["cupón", "cupones"]}
          />
        </div>
      )}
    </>
  );
}
