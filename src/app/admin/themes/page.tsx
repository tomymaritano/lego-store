import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { moveThemeAction } from "@/lib/admin/actions";
import { getAdminThemeList } from "@/lib/admin/data";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderButtons } from "@/components/admin/OrderButtons";
import { Badge, Button, Card, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Temas · Administración",
};

/**
 * /admin/themes: every theme in the "Temas" menu's order (hidden ones too),
 * with how many products use each. "Subir" / "Bajar" reorder them in place.
 */
export default async function AdminThemesPage() {
  await requireAdmin({ callbackUrl: "/admin/themes" });
  const themes = await getAdminThemeList();

  return (
    <>
      <PageHeader
        title="Temas"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Temas" }]}
        description="El orden de acá es el del menú «Temas» y el del filtro del catálogo."
        actions={
          <Button render={<Link href="/admin/themes/new" prefetch={false} />}>
            <Plus aria-hidden="true" />
            Nuevo tema
          </Button>
        }
      />

      {themes.length === 0 ? (
        <Card>
          <EmptyState title="Todavía no hay temas" description="Crea el primero para poder cargar productos." />
        </Card>
      ) : (
        <Table label="Temas" data-testid="admin-themes">
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Tema</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {themes.map((theme, index) => (
              <TableRow key={theme.id} data-testid="admin-theme-row">
                <TableCell className="w-24">
                  <OrderButtons name={theme.name} first={index === 0} last={index === themes.length - 1} action={moveThemeAction.bind(null, theme.id)} />
                </TableCell>
                <TableCell className="min-w-48">
                  <Link href={`/admin/themes/${theme.id}`} prefetch={false} className="font-medium text-fg underline-offset-4 hover:underline">
                    {theme.name}
                  </Link>
                  <span className="flex flex-wrap items-center gap-1.5 text-caption text-fg-muted">
                    <span className="font-mono">{theme.slug}</span>
                    {theme.visible ? null : (
                      <Badge>
                        <EyeOff aria-hidden="true" />
                        Oculto
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {theme.listed}
                  {theme.products > theme.listed ? (
                    <span className="block text-caption text-fg-muted">+{pluralize(theme.products - theme.listed, "archivado")}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button render={<Link href={`/admin/themes/${theme.id}`} prefetch={false} />} variant="ghost" size="sm">
                      <Pencil aria-hidden="true" />
                      Editar<span className="sr-only"> {theme.name}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
