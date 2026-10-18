import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeDollarSign, CalendarDays, Lock, LockOpen, MessageSquareText, ReceiptText, ShieldCheck, ShieldOff } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { setUserBlockedAction, setUserRoleAction } from "@/lib/admin/actions";
import { getAdminUserDetail } from "@/lib/admin/data";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { ADMIN_ORDER_STATUS_LABELS, ORDER_STATUS_BADGE, formatOrderNumber } from "@/lib/orders/format";
import { idSchema } from "@/lib/validations/ids";
import { MAX_BLOCK_REASON } from "@/lib/validations/users";
import { formatPrice, pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminStat } from "@/components/admin/AdminStat";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { pageHref } from "@/components/admin/Pagination";
import { Badge, Card, CardContent, CardHeader, EmptyState, Rating, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

type UserPageProps = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { userId } = await params;
  const id = idSchema.safeParse(userId);
  const user = id.success ? await getAdminUserDetail(id.data) : null;
  return { title: `${user?.name || user?.email || "Usuario"} · Administración` };
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-fg-muted">{term}</dt>
      <dd className="text-label font-normal break-words text-fg">{children}</dd>
    </div>
  );
}

/**
 * /admin/users/<id>: the account (profile, how it signs in, whether it is
 * blocked), its numbers, orders, reviews and the addresses its orders went
 * to, and who changed it (audit log). Role and block are changed here, each
 * behind a confirmation; the server refuses them on the admin's own account
 * and on the last active admin.
 */
export default async function AdminUserPage({ params }: UserPageProps) {
  const { userId } = await params;
  const me = await requireAdmin({ callbackUrl: `/admin/users/${encodeURIComponent(userId)}` });
  const id = idSchema.safeParse(userId);
  const user = id.success ? await getAdminUserDetail(id.data) : null;
  if (!user) notFound();

  const self = user.id === me.id;
  const displayName = user.name || user.email;
  const locked = self || user.lastActiveAdmin;
  const lockedReason = self ? "Es tu propia cuenta: otro admin puede cambiar su rol o bloquearla." : "Es el único admin activo: nombra otro admin antes de quitarle el rol o bloquearla.";
  const signIn = [user.hasPassword ? "Contraseña" : null, ...user.providers.map((provider) => (provider === "google" ? "Google" : provider))].filter(Boolean);

  return (
    <>
      <PageHeader
        title={displayName}
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Usuarios", href: "/admin/users" },
          { label: displayName },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {user.role === "ADMIN" ? <Badge variant="exclusive">Admin</Badge> : <Badge>Cliente</Badge>}
            {user.blocked ? (
              <Badge variant="danger" data-testid="user-status">
                Bloqueada
              </Badge>
            ) : (
              <Badge variant="success" data-testid="user-status">
                Activa
              </Badge>
            )}
            <span>{user.email}</span>
          </span>
        }
        actions={
          locked ? null : (
            <div className="flex flex-wrap gap-2">
              {user.role === "ADMIN" ? (
                <ConfirmAction
                  label="Quitar admin"
                  icon={<ShieldOff aria-hidden="true" />}
                  title={`¿Quitarle el rol de admin a ${displayName}?`}
                  description="Pierde el acceso al panel en su próxima página. Sigue pudiendo comprar con su cuenta."
                  confirmLabel="Quitar admin"
                  action={setUserRoleAction.bind(null, user.id, "USER")}
                  testId="user-demote"
                />
              ) : (
                <ConfirmAction
                  label="Hacer admin"
                  icon={<ShieldCheck aria-hidden="true" />}
                  title={`¿Hacer admin a ${displayName}?`}
                  description="Va a poder ver y cambiar todo el panel: productos, pedidos, reembolsos, cupones y usuarios."
                  confirmLabel="Hacer admin"
                  action={setUserRoleAction.bind(null, user.id, "ADMIN")}
                  testId="user-promote"
                />
              )}
              {user.blocked ? (
                <ConfirmAction
                  label="Desbloquear"
                  icon={<LockOpen aria-hidden="true" />}
                  title={`¿Desbloquear la cuenta de ${displayName}?`}
                  description="Vuelve a poder iniciar sesión con su contraseña o con Google."
                  confirmLabel="Desbloquear"
                  action={setUserBlockedAction.bind(null, user.id, false)}
                  testId="user-unblock"
                />
              ) : (
                <ConfirmAction
                  label="Bloquear"
                  icon={<Lock aria-hidden="true" />}
                  title={`¿Bloquear la cuenta de ${displayName}?`}
                  description="Cerramos todas sus sesiones y no va a poder iniciar sesión. Sus pedidos y reseñas se conservan, y puedes desbloquearla cuando quieras."
                  confirmLabel="Bloquear"
                  confirmVariant="destructive"
                  field={{ label: "Motivo", hint: "Opcional. Solo lo ven los admins.", maxLength: MAX_BLOCK_REASON }}
                  action={setUserBlockedAction.bind(null, user.id, true)}
                  testId="user-block"
                />
              )}
            </div>
          )
        }
      />

      {locked ? (
        <p className="mb-6 rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary" data-testid="user-locked">
          {lockedReason}
        </p>
      ) : null}
      {user.blocked ? (
        <p className="mb-6 rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary" data-testid="user-blocked">
          <span className="font-semibold text-fg">Bloqueada el {formatAdminDateTime(user.blockedAt!)}. </span>
          {user.blockedReason ? `Motivo: ${user.blockedReason}` : "Sin motivo anotado."}
        </p>
      ) : null}

      <section aria-label="Números de la cuenta" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat icon={<ReceiptText />} label="Pedidos" value={<span data-testid="user-orders">{user.orders}</span>} detail="Realizados con esta cuenta" />
        <AdminStat icon={<BadgeDollarSign />} label="Gastado" value={formatPrice(user.spent)} detail="Pedidos pagados, enviados y entregados" />
        <AdminStat icon={<MessageSquareText />} label="Reseñas" value={<span data-testid="user-reviews">{user.reviewCount}</span>} detail={user.reviewCount === 1 ? "Escribió 1 reseña" : `Escribió ${user.reviewCount} reseñas`} />
        <AdminStat icon={<CalendarDays />} label="Alta" value={<span className="text-title whitespace-nowrap" data-testid="user-created">{formatAdminDate(user.createdAt)}</span>} detail={signIn.length > 0 ? `Ingresa con ${signIn.join(" y ")}` : "Sin forma de ingresar"} />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="user-orders-title">
            <h2 id="user-orders-title" className="mb-4 text-title text-fg">
              Pedidos
            </h2>
            {user.recentOrders.length === 0 ? (
              <Card>
                <EmptyState title="Todavía no compró" description="Sus pedidos con esta cuenta aparecen acá. Los que hizo como invitado no." />
              </Card>
            ) : (
              <Table label="Pedidos de la cuenta">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/admin/orders/${order.id}`} prefetch={false} className="font-mono font-semibold text-fg underline-offset-4 hover:underline">
                          {formatOrderNumber(order.number)}
                        </Link>
                        <span className="block text-caption text-fg-muted">{pluralize(order.itemCount, "unidad", "unidades")}</span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-fg-secondary sm:table-cell">{formatAdminDateTime(order.placedAt)}</TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_BADGE[order.status]}>{ADMIN_ORDER_STATUS_LABELS[order.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">{formatPrice(order.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section aria-labelledby="user-addresses-title">
            <h2 id="user-addresses-title" className="mb-4 text-title text-fg">
              Direcciones de envío
            </h2>
            {user.addresses.length === 0 ? (
              <p className="text-label font-normal text-fg-muted">Sin pedidos, sin direcciones.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {user.addresses.map((address) => (
                  <li key={`${address.address}-${address.zipCode}`}>
                    <Card elevation="flat" className="h-full">
                      <CardContent className="space-y-1 text-label font-normal text-fg-secondary">
                        <p className="font-medium text-fg">{address.name}</p>
                        <p>{address.address}</p>
                        <p>
                          {address.city}, {address.state} ({address.zipCode.toUpperCase()})
                        </p>
                        <p>{address.country}</p>
                        <p>{address.phone}</p>
                        <p className="pt-1 text-caption text-fg-muted">
                          {pluralize(address.orders, "pedido")} · último el {formatAdminDate(address.lastUsedAt)}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="user-reviews-title">
            <h2 id="user-reviews-title" className={user.reviewCount > user.reviews.length ? "text-title text-fg" : "mb-4 text-title text-fg"}>
              Reseñas
            </h2>
            {user.reviewCount > user.reviews.length ? (
              <p className="mb-4 text-caption text-fg-muted">
                Las {user.reviews.length} más recientes de {user.reviewCount}.
              </p>
            ) : null}
            {user.reviews.length === 0 ? (
              <p className="text-label font-normal text-fg-muted">No escribió reseñas.</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {user.reviews.map((review) => (
                  <li key={review.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{review.title}</span>
                      <Link href={`/admin/products/${review.product.id}`} prefetch={false} className="text-caption text-fg-muted underline-offset-4 hover:underline">
                        {review.product.name}
                      </Link>
                    </span>
                    <span className="flex items-center gap-3">
                      <Rating value={review.rating} size="sm" />
                      <span className="text-caption text-fg-muted">{formatAdminDate(review.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-title text-fg">Perfil</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <Detail term="Nombre">{user.name || "—"}</Detail>
                <Detail term="Email">{user.email}</Detail>
                <Detail term="Email verificado">{user.emailVerified ? `Sí, el ${formatAdminDate(user.emailVerified)}` : "No"}</Detail>
                <Detail term="Ingresa con">{signIn.length > 0 ? signIn.join(", ") : "—"}</Detail>
                <Detail term="Id">
                  <span className="font-mono">{user.id}</span>
                </Detail>
              </dl>
            </CardContent>
          </Card>
          <AuditHistory entries={user.history} entity={{ type: "user", id: user.id }} title="Cambios en la cuenta" />
          {user.role === "ADMIN" ? (
            <AuditHistory
              entries={user.adminActions}
              entity={{ type: "user", id: user.id }}
              title="Acciones como admin"
              allHref={pageHref("/admin/audit", { actor: user.email }, 1)}
              empty="Todavía no cambió nada en el panel."
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
