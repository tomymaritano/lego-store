import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { deleteCategoryAction, saveCategoryAction } from "@/lib/admin/actions";
import { getAdminCategoryDetail } from "@/lib/admin/data";
import { idSchema } from "@/lib/validations/ids";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { FlashNotice } from "@/components/admin/FlashNotice";
import { Badge, Button, Card, CardContent } from "@/components/ui";

type CategoryPageProps = {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { categoryId } = await params;
  const id = idSchema.safeParse(categoryId);
  const category = id.success ? await getAdminCategoryDetail(id.data) : null;
  return { title: `${category?.name ?? "Categoría"} · Administración` };
}

/**
 * /admin/categories/<slug>: the category's form (a new slug moves this page
 * and leaves the old URL redirecting), its products, deleting it (only when
 * no product uses it) and its audit trail.
 */
export default async function AdminCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { categoryId } = await params;
  await requireAdmin({ callbackUrl: `/admin/categories/${encodeURIComponent(categoryId)}` });
  const id = idSchema.safeParse(categoryId);
  const [category, query] = await Promise.all([id.success ? getAdminCategoryDetail(id.data) : null, searchParams]);
  if (!category) notFound();

  return (
    <>
      <PageHeader
        title={category.name}
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Categorías", href: "/admin/categories" },
          { label: category.name },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">/category/{category.id}</span>
            {category.visible ? <Badge variant="success">Visible</Badge> : <Badge>Oculta</Badge>}
            <span>· {pluralize(category.listed, "producto")} en la tienda</span>
          </span>
        }
        actions={
          category.visible ? (
            <Button render={<Link href={`/category/${category.id}`} target="_blank" rel="noopener" />} variant="secondary" size="sm">
              <ExternalLink aria-hidden="true" />
              Ver en la tienda<span className="sr-only"> (se abre en otra pestaña)</span>
            </Button>
          ) : null
        }
      />

      {query.created === "1" ? (
        <FlashNotice param="created" className="mb-6">
          Creamos la categoría {category.name}.
        </FlashNotice>
      ) : null}
      {query.moved === "1" ? (
        <FlashNotice param="moved" className="mb-6">
          Guardamos los cambios. La URL vieja redirige a /category/{category.id}.
        </FlashNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <CategoryForm
          key={category.id}
          mode="edit"
          action={saveCategoryAction.bind(null, category.id)}
          initial={{
            slug: category.id,
            name: category.name,
            description: category.description,
            image: category.image,
            imageAlt: category.imageAlt,
            visible: category.visible,
          }}
        />
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-title">Productos</h2>
              <p className="text-label font-normal text-fg-secondary">
                {category.products === 0
                  ? "Ningún producto la usa: se puede eliminar."
                  : `La usan ${pluralize(category.products, "producto")}${category.products > category.listed ? " (archivados incluidos)" : ""}: no se puede eliminar, pero sí ocultar.`}
              </p>
              {category.products > 0 ? (
                <Button render={<Link href={`/admin/products?category=${encodeURIComponent(category.id)}&status=all`} prefetch={false} />} variant="secondary" size="sm">
                  Ver sus productos
                </Button>
              ) : (
                <ConfirmAction
                  label="Eliminar"
                  icon={<Trash2 aria-hidden="true" />}
                  variant="ghost"
                  title={`¿Eliminar la categoría «${category.name}»?`}
                  description="Se borra para siempre, con las redirecciones de sus slugs viejos. No se puede deshacer."
                  confirmLabel="Eliminar"
                  confirmVariant="destructive"
                  action={deleteCategoryAction.bind(null, category.id)}
                  redirectTo="/admin/categories"
                  redirectOnlyIfDeleted
                  testId="category-delete"
                />
              )}
              {category.redirects.length > 0 ? (
                <p className="text-caption text-fg-muted">
                  Redirigen acá: {category.redirects.map((slug) => `/category/${slug}`).join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <AuditHistory entries={category.history} entity={{ type: "category", id: category.id }} />
        </div>
      </div>
    </>
  );
}
