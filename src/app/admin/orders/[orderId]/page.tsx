import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, History, MapPin, Package, ReceiptText, UserRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { formatAdminDateTime } from "@/lib/admin/format";
import { getAdminOrderDetail } from "@/lib/admin/data";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
  cancelReasonLabel,
  formatOrderNumber,
  paymentLabel,
} from "@/lib/orders/format";
import { formatPrice, pluralize } from "@/lib/utils";
import { orderIdSchema } from "@/lib/validations/orders";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { OrderStatusActions } from "@/components/admin/OrderStatusActions";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge, Card, CardContent, CardHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pedido · Administración",
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

function Detail({ term, children, mono = false }: { term: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-fg-muted">{term}</dt>
      <dd className={mono ? "font-mono text-caption break-all text-fg" : "text-label text-fg"}>{children}</dd>
    </div>
  );
}

/**
 * /admin/orders/<id>: one order with its lines (as bought), customer and
 * shipping address, payment (card and Stripe ids), the status timeline, who
 * changed what (OrderStatusChange), and the status changes it allows.
 */
export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  await requireAdmin({ callbackUrl: `/admin/orders/${encodeURIComponent(orderId)}` });
  const id = orderIdSchema.safeParse(orderId);
  const order = id.success ? await getAdminOrderDetail(id.data) : null;
  if (!order) notFound();

  const number = formatOrderNumber(order.number);
  const address = order.shippingAddress;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const placedAt = order.submittedAt ?? order.createdAt;

  return (
    <>
      <PageHeader
        title={`Pedido ${number}`}
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Pedidos", href: "/admin/orders" }, { label: number }]}
        description={order.submittedAt ? `Realizado el ${formatAdminDateTime(placedAt)}` : `Creado el ${formatAdminDateTime(order.createdAt)} · sin intento de pago`}
        actions={
          <Badge variant={ORDER_STATUS_BADGE[order.status]} data-testid="admin-order-status">
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <OrderTimeline order={order} />
              {order.status === "CANCELLED" ? (
                <p className="rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary">
                  <span className="font-semibold text-fg">Motivo: </span>
                  {order.cancelReason === "amount_mismatch"
                    ? "Stripe cobró un monto distinto del total del pedido; se reembolsó automáticamente."
                    : cancelReasonLabel(order.cancelReason)}
                </p>
              ) : null}
              <OrderStatusActions order={order} />
            </CardContent>
          </Card>

          <section aria-labelledby="admin-order-items-title" className="space-y-3">
            <SectionTitle id="admin-order-items-title" icon={<Package />}>
              Productos
            </SectionTitle>
            <Table label="Productos del pedido" data-testid="admin-order-items">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item, index) => (
                  <TableRow key={item.productId ?? `deleted-${index}`}>
                    <TableCell className="min-w-56">
                      <div className="flex items-center gap-3">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                          <ProductImage src={item.image} alt="" fill sizes="48px" className="object-contain p-1" />
                        </span>
                        {item.productId ? (
                          <Link href={`/admin/products/${item.productId}`} prefetch={false} className="font-medium underline-offset-4 hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          <span className="font-medium">
                            {item.name} <span className="text-caption text-fg-muted">(producto eliminado)</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPrice(item.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section aria-labelledby="admin-order-history-title" className="space-y-3">
            <SectionTitle id="admin-order-history-title" icon={<History />}>
              Cambios de estado
            </SectionTitle>
            {order.history.length === 0 ? (
              <p className="text-label font-normal text-fg-secondary">Ningún administrador cambió este pedido todavía.</p>
            ) : (
              <ol className="space-y-2" data-testid="admin-order-history">
                {order.history.map((change) => (
                  <li key={change.id} className="rounded-xl border border-border bg-surface px-4 py-3 text-label font-normal text-fg-secondary">
                    <span className="font-semibold text-fg">
                      {ORDER_STATUS_LABELS[change.from]} → {ORDER_STATUS_LABELS[change.to]}
                    </span>{" "}
                    por {change.actorEmail}, el {formatAdminDateTime(change.at)}
                    {change.refundId ? <span className="block font-mono text-caption text-fg-muted">Reembolso {change.refundId}</span> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card>
            <CardHeader>
              <SectionTitle id="admin-order-totals-title" icon={<ReceiptText />}>
                Resumen
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-label font-normal" aria-labelledby="admin-order-totals-title">
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-secondary">Subtotal ({pluralize(units, "unidad", "unidades")})</dt>
                  <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-secondary">Envío</dt>
                  <dd className="tabular-nums">{order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
                  <dt className="text-body font-bold text-fg">Total</dt>
                  <dd className="text-title tabular-nums" data-testid="admin-order-total">
                    {formatPrice(order.total)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="admin-order-customer-title" icon={<UserRound />}>
                Cliente
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <Detail term="Email">{order.email}</Detail>
                <Detail term="Teléfono">{address.phone}</Detail>
                <Detail term="Cuenta">
                  {order.account ? `${order.account.name ?? "Sin nombre"} (${order.account.email})` : "Compra como invitado"}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="admin-order-address-title" icon={<MapPin />}>
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
              </address>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="admin-order-payment-title" icon={<CreditCard />}>
                Pago
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <Detail term="Tarjeta">{order.paymentLast4 ? paymentLabel(order.paymentBrand, order.paymentLast4) : "Sin datos"}</Detail>
                <Detail term="PaymentIntent de Stripe" mono>
                  {order.stripePaymentIntentId ?? "—"}
                </Detail>
                {order.stripeRefundId ? (
                  <Detail term="Reembolso" mono>
                    {order.stripeRefundId}
                  </Detail>
                ) : null}
                {order.paidAt ? <Detail term="Pagado">{formatAdminDateTime(order.paidAt)}</Detail> : null}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
