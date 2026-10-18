import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CalendarCheck, PackageOpen, TriangleAlert, Truck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminDashboard } from "@/lib/admin/data";
import { MISMATCH_WINDOW_DAYS } from "@/lib/admin/dashboard";
import { LOW_STOCK } from "@/lib/admin/format";
import { updateStockAction } from "@/lib/admin/actions";
import { ORDER_STATUS_LABELS } from "@/lib/orders/format";
import { formatPrice, pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminStat } from "@/components/admin/AdminStat";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { StockQuickEdit } from "@/components/admin/StockQuickEdit";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Administración",
};

const STATUS_ORDER = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

/**
 * /admin: how the store is doing today, what needs attention (orders to
 * ship, low stock, charges that did not match), and the latest orders.
 * Admins only (proxy.ts, this page and getAdminDashboard each check); read
 * from the database on every request.
 */
export default async function AdminPage() {
  await requireAdmin({ callbackUrl: "/admin" });
  const dashboard = await getAdminDashboard();

  return (
    <>
      <PageHeader
        title="Panel de administración"
        breadcrumbs={[{ label: "Administración" }]}
        description="Resumen de la tienda: hoy es el día calendario de Argentina."
      />

      {dashboard.amountMismatches > 0 ? (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-label text-fg">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>
            En los últimos {MISMATCH_WINDOW_DAYS} días,{" "}
            {pluralize(dashboard.amountMismatches, "pedido se canceló", "pedidos se cancelaron")} porque Stripe cobró un monto distinto
            del total (y se reembolsó). No debería pasar: revísalos.{" "}
            <Link href="/admin/orders?status=amount_mismatch" prefetch={false} className="font-semibold underline underline-offset-4">
              Ver pedidos
            </Link>
          </p>
        </div>
      ) : null}

      <section aria-labelledby="overview-title" className="space-y-4">
        <h2 id="overview-title" className="sr-only">
          Resumen
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStat icon={<CalendarCheck />} label="Pedidos de hoy" value={dashboard.ordersToday} detail="Con el pago enviado" />
          <AdminStat
            icon={<Banknote />}
            label="Ingresos"
            value={formatPrice(dashboard.revenue)}
            detail={`${formatPrice(dashboard.revenueToday)} hoy · sin cancelados`}
          />
          <AdminStat
            icon={<Truck />}
            label="Por enviar"
            value={dashboard.toShip}
            detail={`${pluralize(dashboard.awaitingPayment, "pago pendiente", "pagos pendientes")}`}
            href="/admin/orders?status=PAID"
            tone={dashboard.toShip > 0 ? "warning" : "default"}
          />
          <AdminStat
            icon={<PackageOpen />}
            label="Stock bajo"
            value={dashboard.lowStock + dashboard.outOfStock}
            detail={`${dashboard.outOfStock} sin stock · ${dashboard.lowStock} con ${LOW_STOCK} o menos`}
            href="/admin/products?stock=low"
            tone={dashboard.outOfStock > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="recent-title" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="recent-title" className="text-title">
              Últimos pedidos
            </h2>
            <Button render={<Link href="/admin/orders" prefetch={false} />} variant="secondary" size="sm">
              Ver todos
            </Button>
          </div>
          {dashboard.recentOrders.length > 0 ? (
            <OrdersTable orders={dashboard.recentOrders} label="Tabla de últimos pedidos" />
          ) : (
            <Card>
              <EmptyState headingLevel="h3" title="Todavía no hay pedidos" description="Cuando alguien compre, lo vas a ver acá." />
            </Card>
          )}

          <Card>
            <CardContent>
              <h2 id="orders-title" className="mb-4 text-title">
                Pedidos por estado
              </h2>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-5" aria-labelledby="orders-title">
                {STATUS_ORDER.map((status) => (
                  <div key={status} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 lg:block lg:border-0 lg:pb-0">
                    <dt className="text-label text-fg-secondary">
                      <Link href={`/admin/orders?status=${status}`} prefetch={false} className="underline-offset-4 hover:underline">
                        {ORDER_STATUS_LABELS[status]}
                      </Link>
                    </dt>
                    <dd className="text-title tabular-nums">{dashboard.ordersByStatus[status]}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="low-stock-title">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <h2 id="low-stock-title" className="text-title">
                Stock bajo
              </h2>
              <Badge variant={dashboard.outOfStock > 0 ? "warning" : "neutral"}>{dashboard.lowStock + dashboard.outOfStock}</Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {dashboard.lowStockProducts.length === 0 ? (
                <p className="text-label font-normal text-fg-secondary">Todos los productos tienen más de {LOW_STOCK} unidades.</p>
              ) : (
                <ul className="divide-y divide-border" data-testid="low-stock">
                  {dashboard.lowStockProducts.map((product) => (
                    <li key={product.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                        <ProductImage src={product.img} alt="" fill sizes="44px" className="object-contain p-1" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={`/admin/products/${product.id}`}
                          prefetch={false}
                          className="line-clamp-2 text-label font-medium text-fg underline-offset-4 hover:underline"
                        >
                          {product.name}
                        </Link>
                        <span className={product.stock === 0 ? "text-caption font-semibold text-danger" : "text-caption text-fg-muted"}>
                          {product.stock === 0 ? "Sin stock" : `Quedan ${product.stock}`}
                        </span>
                      </span>
                      <StockQuickEdit productId={product.id} productName={product.name} stock={product.stock} action={updateStockAction} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
