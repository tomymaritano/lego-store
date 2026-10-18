import type { Metadata } from "next";
import Link from "next/link";
import { Archive, Pencil, Plus, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { archiveProductAction, restoreProductAction, updateStockAction } from "@/lib/admin/actions";
import { getAdminCategories, getAdminProducts } from "@/lib/admin/data";
import { LOW_STOCK } from "@/lib/admin/format";
import { parseProductFilters } from "@/lib/validations/admin";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Pagination } from "@/components/admin/Pagination";
import { StockQuickEdit } from "@/components/admin/StockQuickEdit";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge, Button, Card, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Productos · Administración",
};

/**
 * /admin/products: the catalogue as the admin sees it, archived products
 * included on request. Search (the storefront's own matching, or an exact
 * id), category, status and stock filters live in the URL (a plain GET form),
 * 20 per page. Stock is editable in place; archiving and restoring ask first.
 */
export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/products" });
  const filters = parseProductFilters(await searchParams);
  const [page, categories] = await Promise.all([getAdminProducts(filters), getAdminCategories()]);
  const filtered = Boolean(filters.q || filters.category || filters.stock || filters.status !== "active");

  return (
    <>
      <PageHeader
        title="Productos"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Productos" }]}
        description="Precios, stock y fichas del catálogo. Los cambios se ven en la tienda al instante."
        actions={
          <Button render={<Link href="/admin/products/new" prefetch={false} />}>
            <Plus aria-hidden="true" />
            Nuevo producto
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <form method="get" role="search" aria-label="Filtrar productos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <Field label="Buscar">
            <Input name="q" type="search" defaultValue={filters.q} placeholder="Nombre, tema o id" leftIcon={<Search aria-hidden="true" className="size-4" />} className="h-9" />
          </Field>
          <FilterSelect
            name="category"
            label="Categoría"
            defaultValue={filters.category}
            options={[{ value: "", label: "Todas" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
          />
          <FilterSelect
            name="status"
            label="Estado"
            defaultValue={filters.status}
            options={[
              { value: "active", label: "En la tienda" },
              { value: "archived", label: "Archivados" },
              { value: "all", label: "Todos" },
            ]}
          />
          <FilterSelect
            name="stock"
            label="Stock"
            defaultValue={filters.stock}
            options={[
              { value: "", label: "Cualquiera" },
              { value: "low", label: `Bajo (${LOW_STOCK} o menos)` },
              { value: "out", label: "Sin stock" },
            ]}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {filtered ? (
              <Button render={<Link href="/admin/products" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState
            title="No hay productos con esos filtros"
            description="Prueba con otra búsqueda o limpia los filtros."
            action={
              <Button render={<Link href="/admin/products" prefetch={false} />} variant="secondary">
                Ver todos
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Table label="Productos" data-testid="admin-products">
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((product) => (
                <TableRow key={product.id} data-testid="admin-product-row" data-product-id={product.id}>
                  <TableCell className="min-w-64">
                    <div className="flex items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                        <ProductImage src={product.img} alt="" fill sizes="48px" className="object-contain p-1" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-1">
                        <Link
                          href={`/admin/products/${product.id}`}
                          prefetch={false}
                          className="line-clamp-2 font-medium text-fg underline-offset-4 hover:underline"
                        >
                          {product.name}
                        </Link>
                        <span className="flex flex-wrap items-center gap-1.5 text-caption text-fg-muted">
                          <span className="font-mono">#{product.id}</span>
                          {product.archived ? <Badge>Archivado</Badge> : null}
                          {product.isNew ? <Badge variant="new">Nuevo</Badge> : null}
                          {product.isOnSale ? <Badge variant="sale">Oferta</Badge> : null}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-fg-secondary">{product.categoryName}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <span className="font-semibold">{formatPrice(product.price)}</span>
                    {product.originalPrice ? (
                      <span className="block text-caption text-fg-muted line-through">{formatPrice(product.originalPrice)}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StockQuickEdit productId={product.id} productName={product.name} stock={product.stock} action={updateStockAction} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button render={<Link href={`/admin/products/${product.id}`} prefetch={false} />} variant="ghost" size="sm">
                        <Pencil aria-hidden="true" />
                        Editar<span className="sr-only"> {product.name}</span>
                      </Button>
                      {product.archived ? (
                        <ConfirmAction
                          label={
                            <>
                              Restaurar<span className="sr-only"> {product.name}</span>
                            </>
                          }
                          variant="ghost"
                          title={`¿Volver a publicar «${product.name}»?`}
                          description="Vuelve a aparecer en el catálogo, la búsqueda y su ficha, con el stock que tenga."
                          confirmLabel="Restaurar"
                          action={restoreProductAction.bind(null, product.id)}
                        />
                      ) : (
                        <ConfirmAction
                          label={
                            <>
                              Archivar<span className="sr-only"> {product.name}</span>
                            </>
                          }
                          icon={<Archive aria-hidden="true" />}
                          variant="ghost"
                          title={`¿Archivar «${product.name}»?`}
                          description="Deja de verse en la tienda y sale de los carritos y favoritos. Los pedidos que lo incluyen no cambian, y puedes restaurarlo cuando quieras."
                          confirmLabel="Archivar"
                          action={archiveProductAction.bind(null, product.id)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            path="/admin/products"
            params={{ q: filters.q, category: filters.category, status: filters.status === "active" ? "" : filters.status, stock: filters.stock }}
            page={page.page}
            totalPages={page.totalPages}
            total={page.total}
            noun={["producto"]}
          />
        </div>
      )}
    </>
  );
}
