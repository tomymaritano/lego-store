import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { moveCategoryAction } from "@/lib/admin/actions";
import { getAdminCategoryList } from "@/lib/admin/data";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderButtons } from "@/components/admin/OrderButtons";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge, Button, Card, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Categorías · Administración",
};

/**
 * /admin/categories: every category in the navigation's order (hidden ones
 * too), with how many products each has. "Subir" / "Bajar" reorder them in
 * place; each opens its page to edit it.
 */
export default async function AdminCategoriesPage() {
  await requireAdmin({ callbackUrl: "/admin/categories" });
  const categories = await getAdminCategoryList();

  return (
    <>
      <PageHeader
        title="Categorías"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Categorías" }]}
        description="El orden de acá es el de la navegación y la home. Los cambios se ven en la tienda al instante."
        actions={
          <Button render={<Link href="/admin/categories/new" prefetch={false} />}>
            <Plus aria-hidden="true" />
            Nueva categoría
          </Button>
        }
      />

      {categories.length === 0 ? (
        <Card>
          <EmptyState title="Todavía no hay categorías" description="Crea la primera para poder cargar productos." />
        </Card>
      ) : (
        <Table label="Categorías" data-testid="admin-categories">
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category, index) => (
              <TableRow key={category.id} data-testid="admin-category-row">
                <TableCell className="w-24">
                  <OrderButtons
                    name={category.name}
                    first={index === 0}
                    last={index === categories.length - 1}
                    action={moveCategoryAction.bind(null, category.id)}
                  />
                </TableCell>
                <TableCell className="min-w-56">
                  <div className="flex items-center gap-3">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                      <ProductImage src={category.image} alt="" fill sizes="48px" className="object-contain p-1" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <Link href={`/admin/categories/${category.id}`} prefetch={false} className="font-medium text-fg underline-offset-4 hover:underline">
                        {category.name}
                      </Link>
                      <span className="flex flex-wrap items-center gap-1.5 text-caption text-fg-muted">
                        <span className="font-mono">/category/{category.id}</span>
                        {category.visible ? null : (
                          <Badge>
                            <EyeOff aria-hidden="true" />
                            Oculta
                          </Badge>
                        )}
                      </span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {category.listed}
                  {category.products > category.listed ? (
                    <span className="block text-caption text-fg-muted">+{pluralize(category.products - category.listed, "archivado")}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button render={<Link href={`/admin/categories/${category.id}`} prefetch={false} />} variant="ghost" size="sm">
                      <Pencil aria-hidden="true" />
                      Editar<span className="sr-only"> {category.name}</span>
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
