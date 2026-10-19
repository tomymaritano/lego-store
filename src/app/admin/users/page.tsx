import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminUsers } from "@/lib/admin/data";
import { formatAdminDate } from "@/lib/admin/format";
import { parseUserFilters } from "@/lib/validations/users";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Pagination } from "@/components/admin/Pagination";
import { ExportButton } from "@/components/admin/ExportButton";
import { Badge, Button, Card, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Usuarios · Administración",
};

/**
 * /admin/users: every account, newest first, with what it ordered and spent.
 * Search by name or email, role, status and sign-up dates in the URL (a
 * plain GET form), 20 per page. Each account opens its own page, where its
 * role and block are changed.
 */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/users" });
  const filters = parseUserFilters(await searchParams);
  const page = await getAdminUsers(filters);
  const params = { q: filters.q, role: filters.role, status: filters.status, from: filters.from, to: filters.to };
  const filtered = Object.values(params).some(Boolean);

  return (
    <>
      <PageHeader
        title="Usuarios"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Usuarios" }]}
        description="Las cuentas de la tienda: sus pedidos, su rol y su acceso."
        actions={<ExportButton kind="customers" params={params} />}
      />

      <Card className="mb-6 p-4">
        <form
          method="get"
          role="search"
          aria-label="Filtrar usuarios"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end"
        >
          <Field label="Buscar">
            <Input name="q" type="search" defaultValue={filters.q} placeholder="Nombre o email" leftIcon={<Search aria-hidden="true" className="size-4" />} className="h-9" />
          </Field>
          <FilterSelect
            name="role"
            label="Rol"
            defaultValue={filters.role}
            options={[
              { value: "", label: "Todos" },
              { value: "USER", label: "Clientes" },
              { value: "ADMIN", label: "Admins" },
            ]}
          />
          <FilterSelect
            name="status"
            label="Estado"
            defaultValue={filters.status}
            options={[
              { value: "", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "blocked", label: "Bloqueados" },
            ]}
          />
          <Field label="Alta desde">
            <Input name="from" type="date" defaultValue={filters.from} className="h-9" />
          </Field>
          <Field label="Alta hasta">
            <Input name="to" type="date" defaultValue={filters.to} className="h-9" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {filtered ? (
              <Button render={<Link href="/admin/users" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? "No hay cuentas con esos filtros" : "Todavía no hay cuentas"}
            description={filtered ? "Prueba con otra búsqueda o limpia los filtros." : "Cuando alguien se registre, lo vas a ver acá."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Table label="Usuarios" data-testid="admin-users">
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Alta</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Gastado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((user) => (
                <TableRow key={user.id} data-testid="admin-user-row">
                  <TableCell className="max-w-72">
                    <Link href={`/admin/users/${user.id}`} prefetch={false} className="block truncate font-medium text-fg underline-offset-4 hover:underline">
                      {user.name || user.email}
                    </Link>
                    <span className="block truncate text-caption text-fg-muted">{user.email}</span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1.5">
                      {user.role === "ADMIN" ? <Badge variant="exclusive">Admin</Badge> : null}
                      {user.blocked ? <Badge variant="danger">Bloqueada</Badge> : <Badge variant="success">Activa</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-fg-secondary md:table-cell">{formatAdminDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{user.orders}</TableCell>
                  <TableCell className="hidden text-right font-semibold whitespace-nowrap tabular-nums sm:table-cell">{formatPrice(user.spent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination path="/admin/users" params={params} page={page.page} totalPages={page.totalPages} total={page.total} noun={["cuenta"]} />
        </div>
      )}
    </>
  );
}
