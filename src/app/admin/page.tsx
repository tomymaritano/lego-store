import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CalendarCheck, Inbox, PackageOpen, Percent, Receipt, TriangleAlert, Truck, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminDashboard, getAdminReport } from "@/lib/admin/data";
import { MISMATCH_WINDOW_DAYS } from "@/lib/admin/dashboard";
import { LOW_STOCK, storeDate } from "@/lib/admin/format";
import { updateStockAction } from "@/lib/admin/actions";
import { ADMIN_ORDER_STATUS_LABELS } from "@/lib/orders/format";
import { DEFAULT_RANGE_DAYS, parseDashboardRange } from "@/lib/validations/dashboard";
import { formatPrice, pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaymentsProviderBadge } from "@/components/admin/PaymentsProviderBadge";
import { AdminStat } from "@/components/admin/AdminStat";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { StockQuickEdit } from "@/components/admin/StockQuickEdit";
import { ExportButton } from "@/components/admin/ExportButton";
import { ChartFrame, ColumnChart, RankedBars } from "@/components/admin/charts/Charts";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input } from "@/components/ui";

export const metadata: Metadata = {
  title: "Administración",
};

const STATUS_ORDER = ["PENDING", "PAYMENT_PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

const PRESETS = [7, 30, 90] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const shortDay = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (date: string, format = shortDay) => format.format(new Date(`${date}T00:00:00Z`));

/** "$ 12 mil" for the axis: short, still a peso amount. */
const compactPrice = (value: number) =>
  value >= 1000 ? `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value / 1000)} mil` : formatPrice(value);

const percent = (part: number, whole: number) => (whole > 0 ? `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format((part / whole) * 100)} %` : "—");

type DashboardPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * /admin: how the store is doing (revenue today, in 7 and 30 days; the
 * chosen range's revenue, orders, average order and conversion), what
 * needs attention (orders to ship, pending payments, low stock, new
 * messages, charges that did not match), the range's charts (sales per day,
 * top products, revenue by payment method, coupon usage) and the latest
 * orders. The range is in the URL (?from=&to=, store calendar days; the last
 * 30 days by default). Admins only (proxy.ts, this page and the data
 * functions each check); read from the database on every request.
 */
export default async function AdminPage({ searchParams }: DashboardPageProps) {
  await requireAdmin({ callbackUrl: "/admin" });
  const today = storeDate(new Date());
  const range = parseDashboardRange(await searchParams, today);
  const [dashboard, report] = await Promise.all([getAdminDashboard(), getAdminReport(range)]);
  const rangeLabel = `${dayLabel(range.from, longDay)} al ${dayLabel(range.to, longDay)}`;
  const pendingPayments = dashboard.ordersByStatus.PAYMENT_PENDING;
  const placedInRange = STATUS_ORDER.reduce((sum, status) => sum + report.placedByStatus[status], 0);
  const best = report.sales.reduce((top, day) => (day.revenue > top.revenue ? day : top), report.sales[0]!);
  const labelEvery = Math.ceil(report.sales.length / 8);

  return (
    <>
      <PageHeader
        title="Panel de administración"
        breadcrumbs={[{ label: "Administración" }]}
        description="Resumen de la tienda: los días son los del calendario de Argentina."
        actions={<PaymentsProviderBadge />}
      />

      {dashboard.amountMismatches > 0 ? (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-label text-fg">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>
            En los últimos {MISMATCH_WINDOW_DAYS} días,{" "}
            {pluralize(dashboard.amountMismatches, "pedido se canceló", "pedidos se cancelaron")} porque el proveedor de pagos cobró un monto distinto
            del total (y se reembolsó). No debería pasar: revísalos.{" "}
            <Link href="/admin/orders?status=amount_mismatch" prefetch={false} className="font-semibold underline underline-offset-4">
              Ver pedidos
            </Link>
          </p>
        </div>
      ) : null}

      <section aria-labelledby="overview-title" className="space-y-4">
        <h2 id="overview-title" className="text-title">
          Hoy y lo que necesita atención
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStat
            icon={<Banknote />}
            label="Ingresos de hoy"
            value={formatPrice(report.revenueToday)}
            detail={`${formatPrice(report.revenue7d)} en 7 días · ${formatPrice(report.revenue30d)} en 30`}
          />
          <AdminStat icon={<CalendarCheck />} label="Pedidos de hoy" value={dashboard.ordersToday} detail="Con el pago enviado" />
          <AdminStat
            icon={<Truck />}
            label="Por enviar"
            value={dashboard.toShip}
            detail={pluralize(pendingPayments, "pago en curso", "pagos en curso")}
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
          <AdminStat
            icon={<Wallet />}
            label="Pagos pendientes"
            value={pendingPayments}
            detail="Tickets en efectivo o tarjetas en revisión"
            href="/admin/orders?status=PAYMENT_PENDING"
          />
          <AdminStat
            icon={<Inbox />}
            label="Mensajes nuevos"
            value={report.newMessages}
            detail="Sin leer en la bandeja"
            href="/admin/mensajes?view=NEW"
            tone={report.newMessages > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      <section aria-labelledby="report-title" className="mt-10 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="report-title" className="text-title">
              Ventas del período
            </h2>
            <p className="text-label font-normal text-fg-secondary">Del {rangeLabel}.</p>
          </div>
          <ExportButton kind="orders" params={{ from: range.from, to: range.to }} label="Exportar pedidos del período" />
        </div>

        <Card className="p-4">
          <form method="get" aria-label="Elegir el período" className="flex flex-wrap items-end gap-3">
            <Field label="Desde">
              <Input name="from" type="date" defaultValue={range.from} max={today} className="h-9" />
            </Field>
            <Field label="Hasta">
              <Input name="to" type="date" defaultValue={range.to} max={today} className="h-9" />
            </Field>
            <Button type="submit" size="sm">
              Ver período
            </Button>
            <span className="flex flex-wrap gap-2" role="group" aria-label="Períodos rápidos">
              {PRESETS.map((days) => {
                const from = shiftDay(today, -(days - 1));
                const current = range.from === from && range.to === today;
                return (
                  <Button
                    key={days}
                    render={<Link href={days === DEFAULT_RANGE_DAYS ? "/admin" : `/admin?from=${from}&to=${today}`} prefetch={false} aria-current={current ? "true" : undefined} />}
                    variant={current ? "secondary" : "ghost"}
                    size="sm"
                  >
                    Últimos {days} días
                  </Button>
                );
              })}
            </span>
          </form>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStat icon={<Banknote />} label="Ingresos" value={formatPrice(report.revenue)} detail="Pagados, enviados y entregados" />
          <AdminStat icon={<Receipt />} label="Pedidos pagados" value={report.paidOrders} detail={`${pluralize(placedInRange, "pedido realizado", "pedidos realizados")}`} />
          <AdminStat icon={<Wallet />} label="Ticket promedio" value={formatPrice(report.averageOrder)} detail="Ingresos ÷ pedidos pagados" />
          <AdminStat
            icon={<Percent />}
            label="Conversión"
            value={percent(report.checkoutsPaid, report.checkouts)}
            detail={`${report.checkoutsPaid} de ${pluralize(report.checkouts, "checkout iniciado", "checkouts iniciados")}`}
          />
        </div>

        <ChartFrame
          id="sales"
          title="Ventas por día"
          summary={
            report.revenue > 0
              ? `${formatPrice(report.revenue)} en ${report.range.days} días; el mejor fue el ${dayLabel(best.day)} con ${formatPrice(best.revenue)}.`
              : `Sin ventas pagadas en estos ${report.range.days} días.`
          }
          empty={report.revenue > 0 ? null : "Todavía no hay ventas en este período."}
          table={{
            caption: "Ventas por día",
            columns: ["Día", "Pedidos", "Ingresos"],
            numeric: [false, true, true],
            rows: report.sales.filter((day) => day.orders > 0).map((day) => [dayLabel(day.day, longDay), day.orders, formatPrice(day.revenue)]),
          }}
        >
          <ColumnChart
            points={report.sales.map((day) => ({
              key: day.day,
              label: dayLabel(day.day),
              value: day.revenue,
              tooltip: `${dayLabel(day.day)}: ${formatPrice(day.revenue)} · ${pluralize(day.orders, "pedido")}`,
            }))}
            formatTick={compactPrice}
            showLabel={(index, count) => index % labelEvery === 0 || index === count - 1}
          />
        </ChartFrame>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartFrame
            id="top-products"
            title="Productos más vendidos"
            summary={report.topProducts[0] ? `${report.topProducts[0].name} lidera con ${formatPrice(report.topProducts[0].revenue)}.` : "Sin ventas en el período."}
            empty={report.topProducts.length > 0 ? null : "Sin ventas en el período."}
            table={{
              caption: "Productos más vendidos",
              columns: ["Producto", "Unidades", "Ingresos"],
              numeric: [false, true, true],
              rows: report.topProducts.map((product) => [product.name, product.units, formatPrice(product.revenue)]),
            }}
          >
            <RankedBars
              items={report.topProducts.map((product) => ({
                key: product.productId ?? product.name,
                label: product.name,
                value: product.revenue,
                valueLabel: formatPrice(product.revenue),
                detail: pluralize(product.units, "unidad", "unidades"),
              }))}
            />
          </ChartFrame>

          <ChartFrame
            id="methods"
            title="Ingresos por medio de pago"
            summary={report.byMethod[0] ? `${report.byMethod[0].label}: ${percent(report.byMethod[0].revenue, report.revenue)} de los ingresos.` : "Sin pagos en el período."}
            empty={report.byMethod.length > 0 ? null : "Sin pagos en el período."}
            table={{
              caption: "Ingresos por medio de pago",
              columns: ["Medio", "Pedidos", "Ingresos"],
              numeric: [false, true, true],
              rows: report.byMethod.map((method) => [method.label, method.orders, formatPrice(method.revenue)]),
            }}
          >
            <RankedBars
              items={report.byMethod.map((method) => ({
                key: method.label,
                label: method.label,
                value: method.revenue,
                valueLabel: formatPrice(method.revenue),
                detail: percent(method.revenue, report.revenue),
              }))}
            />
          </ChartFrame>

          <ChartFrame
            id="coupons"
            title="Uso de cupones"
            summary={
              report.coupons.length > 0
                ? `${pluralize(report.coupons.reduce((sum, coupon) => sum + coupon.uses, 0), "uso pagado", "usos pagados")}, ${formatPrice(report.coupons.reduce((sum, coupon) => sum + coupon.discount, 0))} en descuentos.`
                : "Ningún cupón se usó en el período."
            }
            empty={report.coupons.length > 0 ? null : "Ningún cupón se usó en el período."}
            table={{
              caption: "Uso de cupones",
              columns: ["Cupón", "Usos pagados", "Descuento", "Reservados ahora"],
              numeric: [false, true, true, true],
              rows: report.coupons.map((coupon) => [coupon.code, coupon.uses, formatPrice(coupon.discount), coupon.reserved]),
            }}
          >
            <RankedBars
              items={report.coupons.map((coupon) => ({
                key: coupon.code,
                label: coupon.code,
                value: coupon.uses,
                valueLabel: pluralize(coupon.uses, "uso"),
                detail: coupon.reserved > 0 ? `${formatPrice(coupon.discount)} · ${coupon.reserved} reservados` : formatPrice(coupon.discount),
              }))}
            />
          </ChartFrame>

          <Card>
            <CardContent>
              <h3 id="orders-title" className="mb-1 text-title">
                Pedidos del período por estado
              </h3>
              <p className="mb-4 text-label font-normal text-fg-secondary">
                Realizados en el período, según su estado de hoy. {report.newSubscribers > 0 ? `${pluralize(report.newSubscribers, "suscriptor nuevo", "suscriptores nuevos")} al newsletter.` : ""}
              </p>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2" aria-labelledby="orders-title">
                {STATUS_ORDER.map((status) => (
                  <div key={status} className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                    <dt className="text-label text-fg-secondary">
                      <Link href={`/admin/orders?status=${status}&from=${range.from}&to=${range.to}`} prefetch={false} className="underline-offset-4 hover:underline">
                        {ADMIN_ORDER_STATUS_LABELS[status]}
                      </Link>
                    </dt>
                    <dd className="text-title tabular-nums">{report.placedByStatus[status]}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="mt-10 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
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
