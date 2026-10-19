import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listUserOrders } from "@/lib/orders/queries";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderCard } from "@/components/account/OrderCard";
import { Button, Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Mis pedidos",
  robots: { index: false, follow: false },
};

/** /account/orders: the signed-in user's orders, newest first. Per user, so rendered on every request. */
export default async function OrdersPage() {
  const user = await requireUser({ callbackUrl: "/account/orders" });
  const orders = await listUserOrders(getDb(), user.id);

  return (
    <div className="container-custom py-8 md:py-12">
      <PageHeader
        title="Mis pedidos"
        breadcrumbs={[{ label: "Mi cuenta", href: "/account" }, { label: "Mis pedidos" }]}
        description={orders.length > 0 ? pluralize(orders.length, "pedido") : undefined}
      />
      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageOpen />}
            title="Todavía no hiciste pedidos"
            description="Cuando compres algo, podrás seguir tu pedido desde aquí."
            action={<Button render={<Link href="/" />}>Ver productos</Button>}
          />
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Pedidos">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
