import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, MapPin, Package, ReceiptText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
  cancelReasonLabel,
  formatOrderDate,
  formatOrderNumber,
  orderPlacedAt,
  orderPaymentLabel,
} from "@/lib/orders/format";
import { getUserOrder } from "@/lib/orders/queries";
import { formatPrice } from "@/lib/utils";
import { orderIdSchema } from "@/lib/validations/orders";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { PendingPaymentNotice } from "@/components/orders/PendingPaymentNotice";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Detalle del pedido",
  robots: { index: false, follow: false },
};

function SectionTitle({ id, icon, children }: { id: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-title">
      <span aria-hidden="true" className="text-info [&_svg]:size-5">
        {icon}
      </span>
      {children}
    </h2>
  );
}

/**
 * /account/orders/<id>: one of the signed-in user's orders, with its status
 * timeline (with the cash ticket to pay while a Mercado Pago payment is
 * pending), the lines as they were bought (snapshots: name, price and picture
 * at order time), totals, address and payment. Anyone else's order, or an
 * unknown id, is a 404. Per user, so rendered on every request.
 */
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser({ callbackUrl: `/account/orders/${encodeURIComponent(orderId)}` });
  const id = orderIdSchema.safeParse(orderId);
  const order = id.success ? await getUserOrder(getDb(), user.id, id.data) : null;
  if (!order) notFound();

  const number = formatOrderNumber(order.number);
  const address = order.shippingAddress;
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="container-custom py-8 md:py-12">
      <PageHeader
        title={`Pedido ${number}`}
        breadcrumbs={[{ label: "Mi cuenta", href: "/account" }, { label: "Mis pedidos", href: "/account/orders" }, { label: number }]}
        description={`Realizado el ${formatOrderDate(orderPlacedAt(order))}`}
        actions={
          <Badge variant={ORDER_STATUS_BADGE[order.status]} data-testid="order-status">
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <OrderTimeline order={order} />
              {order.status === "CANCELLED" ? (
                <p className="rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary">{cancelReasonLabel(order.cancelReason)}</p>
              ) : order.status === "PENDING" ? (
                <p className="rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary">
                  Estamos esperando la confirmación del pago. Te avisaremos por email.
                </p>
              ) : order.status === "PAYMENT_PENDING" ? (
                <PendingPaymentNotice order={order} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="order-items-title" icon={<Package />}>
                Productos
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <ul aria-labelledby="order-items-title" className="divide-y divide-border" data-testid="order-items">
                {order.items.map((item, index) => (
                  <li key={item.productId ?? `deleted-${index}`} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-bg-subtle">
                      <ProductImage src={item.image} alt="" fill sizes="64px" className="object-contain p-1.5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      {item.productId ? (
                        <Link href={`/item/${item.productId}`} className="line-clamp-2 font-medium text-fg hover:underline">
                          {item.name}
                        </Link>
                      ) : (
                        <span className="line-clamp-2 font-medium text-fg">{item.name}</span>
                      )}
                      <span className="text-caption text-fg-muted tabular-nums">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </span>
                    </span>
                    <span className="text-body text-fg tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <SectionTitle id="order-totals-title" icon={<ReceiptText />}>
                Resumen
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-label font-normal" aria-labelledby="order-totals-title">
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-secondary">Subtotal ({count === 1 ? "1 producto" : `${count} productos`})</dt>
                  <dd className="text-fg tabular-nums">{formatPrice(order.subtotal)}</dd>
                </div>
                {order.discount > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-secondary">
                      Descuento{order.couponCode ? <span className="ml-1 font-mono text-caption text-fg-muted">({order.couponCode})</span> : null}
                    </dt>
                    <dd className="font-semibold text-success tabular-nums" data-testid="order-discount">
                      −{formatPrice(order.discount)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-secondary">Envío</dt>
                  <dd className={order.shipping === 0 ? "font-semibold text-success" : "text-fg tabular-nums"}>
                    {order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
                  <dt className="text-body font-bold text-fg">Total</dt>
                  <dd className="text-title text-fg tabular-nums" data-testid="order-total">
                    {formatPrice(order.total)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="order-address-title" icon={<MapPin />}>
                Envío
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <address className="space-y-0.5 text-label font-normal text-fg-secondary not-italic">
                <p className="font-medium text-fg">
                  {address.firstName} {address.lastName}
                </p>
                <p>{address.address}</p>
                <p>
                  {address.city}, {address.state} {address.zipCode}
                </p>
                <p>{address.country}</p>
                <p className="pt-2">{order.email}</p>
                <p>{address.phone}</p>
              </address>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="order-payment-title" icon={<CreditCard />}>
                Pago
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <p className="text-label text-fg">{orderPaymentLabel(order)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
