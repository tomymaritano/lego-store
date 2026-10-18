import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeDollarSign, Clock, ReceiptText, TicketPercent } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { saveCouponAction, setCouponActiveAction } from "@/lib/admin/actions";
import { getAdminCouponDetail } from "@/lib/admin/data";
import {
  AUDIT_ACTION_LABELS,
  COUPON_FIELD_LABELS,
  COUPON_STATUS_BADGE,
  COUPON_STATUS_LABELS,
  REDEMPTION_STATUS_BADGE,
  REDEMPTION_STATUS_LABELS,
  couponDateInput,
  couponWindowLabel,
  formatAdminDateTime,
} from "@/lib/admin/format";
import { ADMIN_ORDER_STATUS_LABELS, formatOrderNumber } from "@/lib/orders/format";
import { idSchema } from "@/lib/validations/ids";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminStat } from "@/components/admin/AdminStat";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { CouponForm } from "@/components/admin/CouponForm";
import { FlashNotice } from "@/components/admin/FlashNotice";
import { Badge, Card, CardContent, CardHeader, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

type CouponPageProps = {
  params: Promise<{ couponId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<CouponPageProps, "params">): Promise<Metadata> {
  const { couponId } = await params;
  const id = idSchema.safeParse(couponId);
  const coupon = id.success ? await getAdminCouponDetail(id.data) : null;
  return { title: `${coupon?.code ?? "Cupón"} · Administración` };
}

/** An audit entry's changes in words: "valor: 10 → 15; vence: — → 31/12/2026". */
function describeChanges(changes: Record<string, unknown> | null, action: string): string | null {
  if (!changes || action === "coupon.create" || action === "coupon.activate" || action === "coupon.deactivate") return null;
  const show = (value: unknown) => (value === null || value === "" ? "—" : typeof value === "boolean" ? (value ? "sí" : "no") : String(value));
  const parts = Object.entries(changes).flatMap(([field, value]) => {
    if (!Array.isArray(value)) return [];
    const [from, to] = value as [unknown, unknown];
    const date = field === "startsAt" || field === "expiresAt";
    const asText = (v: unknown) => (date && typeof v === "string" ? couponDateInput(v, field === "expiresAt" ? "end" : "start") : show(v));
    return [`${COUPON_FIELD_LABELS[field] ?? field}: ${asText(from) || "—"} → ${asText(to) || "—"}`];
  });
  return parts.length > 0 ? parts.join("; ") : null;
}

/**
 * /admin/coupons/<id>: the coupon's numbers (uses, unpaid reservations,
 * discount given, sales), its terms to edit, its latest uses with their
 * orders, and who changed what (audit log).
 */
export default async function AdminCouponPage({ params, searchParams }: CouponPageProps) {
  const { couponId } = await params;
  await requireAdmin({ callbackUrl: `/admin/coupons/${encodeURIComponent(couponId)}` });
  const id = idSchema.safeParse(couponId);
  const [coupon, query] = await Promise.all([id.success ? getAdminCouponDetail(id.data) : null, searchParams]);
  if (!coupon) notFound();

  return (
    <>
      <PageHeader
        title={coupon.code}
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Cupones", href: "/admin/coupons" },
          { label: coupon.code },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={COUPON_STATUS_BADGE[coupon.status]} data-testid="coupon-status">
              {COUPON_STATUS_LABELS[coupon.status]}
            </Badge>
            <span>
              {coupon.label}
              {coupon.minSubtotal > 0 ? ` · desde ${formatPrice(coupon.minSubtotal)}` : ""} · {couponWindowLabel(coupon.startsAt, coupon.expiresAt)}
            </span>
          </span>
        }
        actions={
          coupon.active ? (
            <ConfirmAction
              label="Desactivar"
              variant="secondary"
              size="sm"
              title={`¿Desactivar ${coupon.code}?`}
              description="Deja de servir en pedidos nuevos. Los pedidos que ya lo aplicaron conservan el descuento."
              confirmLabel="Desactivar"
              action={setCouponActiveAction.bind(null, coupon.id, false)}
              testId="coupon-deactivate"
            />
          ) : (
            <ConfirmAction
              label="Activar"
              variant="secondary"
              size="sm"
              title={`¿Activar ${coupon.code}?`}
              description="Vuelve a servir en el carrito y el checkout, con sus fechas y límites."
              confirmLabel="Activar"
              action={setCouponActiveAction.bind(null, coupon.id, true)}
              testId="coupon-activate"
            />
          )
        }
      />

      {query.created === "1" ? (
        <FlashNotice param="created" className="mb-6">
          Creamos el cupón {coupon.code}.
        </FlashNotice>
      ) : null}

      <section aria-label="Números del cupón" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          icon={<TicketPercent />}
          label="Usos"
          value={
            <span data-testid="coupon-uses">
              {coupon.uses}
              {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
            </span>
          }
          detail={coupon.maxPerUser !== null ? `Hasta ${coupon.maxPerUser} por cliente` : "Sin límite por cliente"}
          tone={coupon.status === "exhausted" ? "warning" : "default"}
        />
        <AdminStat
          icon={<Clock />}
          label="Sin pagar"
          value={<span data-testid="coupon-reserved">{coupon.reserved}</span>}
          detail={`Reservas que esperan el pago · ${coupon.released === 1 ? "1 uso liberado" : `${coupon.released} usos liberados`} por pedidos cancelados`}
        />
        <AdminStat
          icon={<BadgeDollarSign />}
          label="Descuento otorgado"
          value={<span data-testid="coupon-discount-given">{formatPrice(coupon.discountGiven)}</span>}
          detail={`En ${coupon.redeemed === 1 ? "1 pedido pagado" : `${coupon.redeemed} pedidos pagados`}`}
        />
        <AdminStat
          icon={<ReceiptText />}
          label="Ventas con el cupón"
          value={<span data-testid="coupon-revenue">{formatPrice(coupon.revenue)}</span>}
          detail={`Total cobrado en ${coupon.redeemed === 1 ? "1 pedido pagado" : `${coupon.redeemed} pedidos pagados`}`}
        />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CouponForm
          mode="edit"
          action={saveCouponAction.bind(null, coupon.id)}
          initial={{
            code: coupon.code,
            description: coupon.description,
            type: coupon.type,
            value: coupon.value,
            minSubtotal: coupon.minSubtotal,
            startsAt: couponDateInput(coupon.startsAt, "start"),
            expiresAt: couponDateInput(coupon.expiresAt, "end"),
            maxRedemptions: coupon.maxRedemptions,
            maxPerUser: coupon.maxPerUser,
            active: coupon.active,
          }}
        />

        <Card className="self-start">
          <CardHeader>
            <h2 className="text-title text-fg">Historial</h2>
          </CardHeader>
          <CardContent>
            {coupon.history.length === 0 ? (
              <p className="text-label font-normal text-fg-muted">Sin cambios registrados.</p>
            ) : (
              <ol className="space-y-3 text-label font-normal" data-testid="coupon-history">
                {coupon.history.map((entry) => {
                  const detail = describeChanges(entry.changes, entry.action);
                  return (
                    <li key={entry.id} className="border-l-2 border-border pl-3">
                      <span className="font-medium text-fg">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
                      <span className="block text-caption text-fg-muted">
                        {entry.actorEmail} · {formatAdminDateTime(entry.at)}
                      </span>
                      {detail ? <span className="block text-caption text-fg-secondary">{detail}</span> : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="coupon-redemptions-title" className="mt-10">
        <h2 id="coupon-redemptions-title" className="mb-4 text-title text-fg">
          Usos
        </h2>
        {coupon.redemptions.length === 0 ? (
          <Card>
            <EmptyState title="Todavía nadie lo usó" description="Cuando un pedido lo aplique, aparece acá con su estado." />
          </Card>
        ) : (
          <Table label="Usos del cupón" data-testid="coupon-redemptions">
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead className="text-right">Descuento</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Total</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupon.redemptions.map((use) => (
                <TableRow key={use.id} data-testid="coupon-redemption-row">
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/admin/orders/${use.orderId}`} prefetch={false} className="font-mono font-medium text-fg underline-offset-4 hover:underline">
                      {formatOrderNumber(use.orderNumber)}
                    </Link>
                    <span className="block text-caption text-fg-muted">{ADMIN_ORDER_STATUS_LABELS[use.orderStatus]}</span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="block truncate">{use.email}</span>
                    <span className="block text-caption text-fg-muted">{use.hasAccount ? "Con cuenta" : "Invitado"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={REDEMPTION_STATUS_BADGE[use.status]}>{REDEMPTION_STATUS_LABELS[use.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">−{formatPrice(use.discount)}</TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">{formatPrice(use.orderTotal)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-fg-secondary md:table-cell">{formatAdminDateTime(use.at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
