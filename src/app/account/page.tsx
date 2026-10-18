import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, LayoutDashboard, LogOut, Package, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listUserOrders } from "@/lib/orders/queries";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderCard } from "@/components/account/OrderCard";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordForm } from "@/components/account/PasswordForm";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { logoutAction } from "@/lib/auth/actions";
import { changePasswordAction, dismissPasswordNoticeAction, updateProfileAction } from "./actions";
import { hasPasswordChangedFlash } from "./flash";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

function SectionTitle({ id, icon, children }: { id: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-title">
      <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-fg [&_svg]:size-5">
        {icon}
      </span>
      {children}
    </h2>
  );
}

/** How many recent orders /account lists before "Ver todos". */
const RECENT_ORDERS = 3;

/** /account: recent orders, profile, password and session. Per-user, so rendered on every request. */
export default async function AccountPage() {
  const user = await requireUser({ callbackUrl: "/account" });
  const [passwordChanged, orders] = await Promise.all([
    hasPasswordChangedFlash(user.id),
    listUserOrders(getDb(), user.id, { take: RECENT_ORDERS + 1 }),
  ]);
  const firstName = user.name?.split(/\s+/)[0];

  return (
    <div className="container-custom py-8 md:py-12">
      <PageHeader
        title="Mi cuenta"
        description={
          <>
            {firstName ? `Hola, ${firstName}. ` : null}Ingresaste como <strong className="font-semibold text-fg">{user.email}</strong>.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <SectionTitle id="orders-title" icon={<Package />}>
                Mis pedidos
              </SectionTitle>
              {orders.length > 0 ? (
                <Button variant="ghost" size="sm" render={<Link href="/account/orders" />}>
                  {orders.length > RECENT_ORDERS ? "Ver todos" : "Ver pedidos"}
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-fg-secondary">
                  Todavía no hiciste pedidos.{" "}
                  <Link href="/" className="font-medium text-info underline underline-offset-4 hover:no-underline">
                    Ver productos
                  </Link>
                </p>
              ) : (
                <ul className="space-y-3" aria-labelledby="orders-title">
                  {orders.slice(0, RECENT_ORDERS).map((order) => (
                    <li key={order.id}>
                      <OrderCard order={order} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="profile-title" icon={<UserRound />}>
                Tus datos
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm action={updateProfileAction} name={user.name ?? ""} email={user.email} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle id="password-title" icon={<KeyRound />}>
                Contraseña
              </SectionTitle>
              {user.hasPassword ? (
                <p className="text-fg-muted">Al cambiarla, se cierra la sesión en tus otros dispositivos.</p>
              ) : null}
            </CardHeader>
            <CardContent>
              {user.hasPassword ? (
                <PasswordForm
                  action={changePasswordAction}
                  notice={passwordChanged ? "Cambiamos tu contraseña. Cerramos la sesión en tus otros dispositivos." : undefined}
                  onNoticeShown={dismissPasswordNoticeAction}
                />
              ) : (
                <p className="text-fg-secondary">Ingresas con Google, así que tu cuenta no tiene contraseña propia.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card elevation="flat" className="bg-bg-subtle lg:sticky lg:top-24">
          <CardContent className="space-y-4">
            <h2 className="text-title">Sesión</h2>
            <dl className="space-y-1">
              <dt className="sr-only">Email</dt>
              <dd className="truncate font-semibold">{user.email}</dd>
              <dt className="sr-only">Tipo de cuenta</dt>
              <dd>
                <Badge variant={user.role === "ADMIN" ? "exclusive" : "neutral"}>{user.role === "ADMIN" ? "Administrador" : "Cliente"}</Badge>
              </dd>
            </dl>
            {user.role === "ADMIN" ? (
              <Button variant="secondary" className="w-full" render={<Link href="/admin" />}>
                <LayoutDashboard aria-hidden="true" />
                Panel de administración
              </Button>
            ) : null}
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="w-full">
                <LogOut aria-hidden="true" />
                Cerrar sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
