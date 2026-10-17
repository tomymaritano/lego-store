import type { Metadata } from "next";
import { Boxes, PackageCheck, TriangleAlert, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminOverview, LOW_STOCK } from "@/lib/admin/overview";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

const STATUS_LABELS = {
  PENDING: "Pendientes de pago",
  PAID: "Pagados",
  SHIPPED: "Enviados",
  DELIVERED: "Entregados",
  CANCELLED: "Cancelados",
} as const;

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail?: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-fg [&_svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-label text-fg-secondary">{label}</p>
          <p className="text-headline tabular-nums">{value}</p>
          {detail ? <p className="text-caption text-fg-muted">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** /admin: store overview. Admins only (proxy.ts, this page and getAdminOverview each check). */
export default async function AdminPage() {
  await requireAdmin({ callbackUrl: "/admin" });
  const overview = await getAdminOverview();
  const orders = Object.values(overview.ordersByStatus).reduce((sum, count) => sum + count, 0);

  return (
    <div className="container-custom py-8 md:py-12">
      <PageHeader title="Panel de administración" description="Resumen de la tienda." />

      <section aria-labelledby="overview-title" className="space-y-4">
        <h2 id="overview-title" className="sr-only">
          Resumen
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Boxes />} label="Productos" value={overview.products} />
          <Stat
            icon={<TriangleAlert />}
            label="Sin stock"
            value={overview.outOfStock}
            detail={`${pluralize(overview.lowStock, "producto")} con ${LOW_STOCK} unidades o menos`}
          />
          <Stat icon={<PackageCheck />} label="Pedidos" value={orders} />
          <Stat icon={<Users />} label="Usuarios" value={overview.users} />
        </div>
      </section>

      <section aria-labelledby="orders-title" className="mt-8">
        <Card>
          <CardContent>
            <h2 id="orders-title" className="mb-4 text-title">
              Pedidos por estado
            </h2>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <div key={status} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 lg:block lg:border-0 lg:pb-0">
                  <dt className="text-label text-fg-secondary">{label}</dt>
                  <dd className="text-title tabular-nums">{overview.ordersByStatus[status as keyof typeof STATUS_LABELS]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
