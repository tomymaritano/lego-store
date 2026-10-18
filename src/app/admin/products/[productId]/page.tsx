import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { archiveProductAction, removeProductAction, restoreProductAction, saveProductAction } from "@/lib/admin/actions";
import { getAdminProductForEdit, getProductFormOptions } from "@/lib/admin/data";
import { formatOrderDate } from "@/lib/orders/format";
import { idSchema } from "@/lib/validations/ids";
import { pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormAlert } from "@/components/auth/FormAlert";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { ProductForm } from "@/components/admin/ProductForm";
import { Badge, Button, Card, CardContent } from "@/components/ui";

export const metadata: Metadata = {
  title: "Editar producto · Administración",
};

/**
 * /admin/products/<id>: every field of the product, its state on the store,
 * and archive / restore / delete (deleting a product that orders reference
 * archives it instead).
 */
export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productId } = await params;
  await requireAdmin({ callbackUrl: `/admin/products/${encodeURIComponent(productId)}` });
  const id = idSchema.safeParse(productId);
  const [product, options, query] = await Promise.all([
    id.success ? getAdminProductForEdit(id.data) : null,
    getProductFormOptions(),
    searchParams,
  ]);
  if (!product) notFound();
  const archived = product.archivedAt !== null;

  return (
    <>
      <PageHeader
        title={product.name}
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Productos", href: "/admin/products" },
          { label: product.name },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">#{product.id}</span>
            {archived ? <Badge>Archivado</Badge> : <Badge variant="success">En la tienda</Badge>}
            <span>· {pluralize(product.reviewCount, "reseña")}</span>
          </span>
        }
        actions={
          archived ? null : (
            <Button render={<Link href={`/item/${product.id}`} target="_blank" rel="noopener" />} variant="secondary" size="sm">
              <ExternalLink aria-hidden="true" />
              Ver en la tienda<span className="sr-only"> (se abre en otra pestaña)</span>
            </Button>
          )
        }
      />

      {query.created === "1" ? <FormAlert tone="success" className="mb-6">Creamos el producto: ya está en la tienda.</FormAlert> : null}
      {archived ? (
        <FormAlert className="mb-6">
          Archivado el {formatOrderDate(product.archivedAt!)}: no se ve en la tienda. Restáuralo para volver a venderlo.
        </FormAlert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <ProductForm
          mode="edit"
          action={saveProductAction.bind(null, product.id)}
          initial={product}
          categories={options.categories}
          suggestions={options.suggestions}
        />

        <Card className="xl:sticky xl:top-24">
          <CardContent className="space-y-4">
            <h2 className="text-title">En la tienda</h2>
            <p className="text-label font-normal text-fg-secondary">
              {product.orderLines > 0
                ? `Está en ${pluralize(product.orderLines, "pedido")}: se puede archivar, pero no eliminar.`
                : "Ningún pedido lo incluye todavía: eliminarlo lo borra con sus reseñas."}
            </p>
            <div className="flex flex-col gap-2">
              {archived ? (
                <ConfirmAction
                  label="Restaurar"
                  icon={<RotateCcw aria-hidden="true" />}
                  title={`¿Volver a publicar «${product.name}»?`}
                  description="Vuelve a aparecer en el catálogo, la búsqueda y su ficha, con el stock que tenga."
                  confirmLabel="Restaurar"
                  action={restoreProductAction.bind(null, product.id)}
                />
              ) : (
                <ConfirmAction
                  label="Archivar"
                  icon={<Archive aria-hidden="true" />}
                  title={`¿Archivar «${product.name}»?`}
                  description="Deja de verse en la tienda y sale de los carritos y favoritos. Los pedidos que lo incluyen no cambian, y puedes restaurarlo cuando quieras."
                  confirmLabel="Archivar"
                  action={archiveProductAction.bind(null, product.id)}
                />
              )}
              <ConfirmAction
                label="Eliminar"
                icon={<Trash2 aria-hidden="true" />}
                variant="ghost"
                title={`¿Eliminar «${product.name}»?`}
                description={
                  product.orderLines > 0
                    ? "Está en pedidos, así que no se borra: se archiva (deja de verse en la tienda) y los pedidos siguen mostrándolo."
                    : "Se borra para siempre, con sus reseñas, y sale de los carritos y favoritos. No se puede deshacer."
                }
                confirmLabel={product.orderLines > 0 ? "Archivar" : "Eliminar"}
                confirmVariant="destructive"
                action={removeProductAction.bind(null, product.id)}
                redirectTo="/admin/products"
                redirectOnlyIfDeleted
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
