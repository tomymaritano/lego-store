import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { deleteThemeAction, saveThemeAction } from "@/lib/admin/actions";
import { getAdminThemeDetail } from "@/lib/admin/data";
import { themeHref } from "@/config/navigation";
import { idSchema } from "@/lib/validations/ids";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { FlashNotice } from "@/components/admin/FlashNotice";
import { ThemeForm } from "@/components/admin/ThemeForm";
import { Badge, Button, Card, CardContent } from "@/components/ui";

type ThemePageProps = {
  params: Promise<{ themeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<ThemePageProps, "params">): Promise<Metadata> {
  const { themeId } = await params;
  const id = idSchema.safeParse(themeId);
  const theme = id.success ? await getAdminThemeDetail(id.data) : null;
  return { title: `${theme?.name ?? "Tema"} · Administración` };
}

/** /admin/themes/<id>: the theme's form, its products, deleting it (only when no product uses it) and its audit trail. */
export default async function AdminThemePage({ params, searchParams }: ThemePageProps) {
  const { themeId } = await params;
  await requireAdmin({ callbackUrl: `/admin/themes/${encodeURIComponent(themeId)}` });
  const id = idSchema.safeParse(themeId);
  const [theme, query] = await Promise.all([id.success ? getAdminThemeDetail(id.data) : null, searchParams]);
  if (!theme) notFound();

  return (
    <>
      <PageHeader
        title={theme.name}
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Temas", href: "/admin/themes" },
          { label: theme.name },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{theme.slug}</span>
            {theme.visible ? <Badge variant="success">Visible</Badge> : <Badge>Oculto</Badge>}
            <span>· {pluralize(theme.listed, "producto")} en la tienda</span>
          </span>
        }
        actions={
          <Button render={<Link href={themeHref(theme.slug)} target="_blank" rel="noopener" />} variant="secondary" size="sm">
            <ExternalLink aria-hidden="true" />
            Ver en la tienda<span className="sr-only"> (se abre en otra pestaña)</span>
          </Button>
        }
      />

      {query.created === "1" ? (
        <FlashNotice param="created" className="mb-6">
          Creamos el tema {theme.name}.
        </FlashNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <ThemeForm mode="edit" action={saveThemeAction.bind(null, theme.id)} initial={{ name: theme.name, slug: theme.slug, visible: theme.visible }} />
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-title">Productos</h2>
              <p className="text-label font-normal text-fg-secondary">
                {theme.products === 0
                  ? "Ningún producto lo usa: se puede eliminar."
                  : `Lo usan ${pluralize(theme.products, "producto")}${theme.products > theme.listed ? " (archivados incluidos)" : ""}: no se puede eliminar, pero sí ocultar.`}
              </p>
              {theme.products === 0 ? (
                <ConfirmAction
                  label="Eliminar"
                  icon={<Trash2 aria-hidden="true" />}
                  variant="ghost"
                  title={`¿Eliminar el tema «${theme.name}»?`}
                  description="Se borra para siempre. No se puede deshacer."
                  confirmLabel="Eliminar"
                  confirmVariant="destructive"
                  action={deleteThemeAction.bind(null, theme.id)}
                  redirectTo="/admin/themes"
                  redirectOnlyIfDeleted
                  testId="theme-delete"
                />
              ) : null}
            </CardContent>
          </Card>
          <AuditHistory entries={theme.history} entity={{ type: "theme", id: theme.id }} />
        </div>
      </div>
    </>
  );
}
