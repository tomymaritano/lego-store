import type { Metadata } from "next";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { deleteReviewAsAdminAction } from "@/lib/admin/actions";
import { getAdminReviews } from "@/lib/admin/data";
import { formatOrderDate } from "@/lib/orders/format";
import { parseReviewFilters } from "@/lib/validations/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, Button, Card, EmptyState, Field, Input, Rating } from "@/components/ui";

export const metadata: Metadata = {
  title: "Reseñas · Administración",
};

/**
 * /admin/reviews: moderation. Every review, newest first, filtered by
 * product, stars or text (title, comment, author, product name). Deleting
 * one recomputes the product's rating and refreshes its page.
 */
export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin({ callbackUrl: "/admin/reviews" });
  const filters = parseReviewFilters(await searchParams);
  const page = await getAdminReviews(filters);
  const filtered = Boolean(filters.q || filters.product || filters.rating);

  return (
    <>
      <PageHeader
        title="Reseñas"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Reseñas" }]}
        description="Elimina las reseñas que no cumplan las reglas: la calificación del producto se recalcula sola."
      />

      <Card className="mb-6 p-4">
        <form
          method="get"
          role="search"
          aria-label="Filtrar reseñas"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] lg:items-end"
        >
          <Field label="Buscar">
            <Input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Texto, autor o producto"
              leftIcon={<Search aria-hidden="true" className="size-4" />}
              className="h-9"
            />
          </Field>
          <FilterSelect
            name="product"
            label="Producto"
            defaultValue={filters.product}
            options={[{ value: "", label: "Todos" }, ...page.products.map((product) => ({ value: product.id, label: product.name }))]}
          />
          <FilterSelect
            name="rating"
            label="Estrellas"
            defaultValue={filters.rating ? String(filters.rating) : ""}
            options={[{ value: "", label: "Todas" }, ...[5, 4, 3, 2, 1].map((stars) => ({ value: String(stars), label: `${stars} ★` }))]}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {filtered ? (
              <Button render={<Link href="/admin/reviews" prefetch={false} />} variant="ghost" size="sm">
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <EmptyState title={filtered ? "No hay reseñas con esos filtros" : "Todavía no hay reseñas"} />
        </Card>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3" data-testid="admin-reviews">
            {page.items.map((review) => (
              <li key={review.id} data-testid="admin-review">
                <Card>
                  <article aria-labelledby={`review-${review.id}`} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Rating value={review.rating} size="sm" />
                        <h2 id={`review-${review.id}`} className="text-body font-semibold text-fg">
                          {review.title}
                        </h2>
                      </div>
                      <p className="text-label font-normal break-words whitespace-pre-line text-fg-secondary">{review.comment}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-fg-muted">
                        <span>
                          {review.author.name ?? "Sin nombre"} ({review.author.email})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatOrderDate(review.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <Link href={`/admin/products/${review.product.id}`} prefetch={false} className="underline underline-offset-4">
                          {review.product.name}
                        </Link>
                        {review.product.archived ? <Badge>Archivado</Badge> : null}
                        {review.helpful > 0 ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{review.helpful === 1 ? "1 voto útil" : `${review.helpful} votos útiles`}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <ConfirmAction
                      label={
                        <>
                          Eliminar<span className="sr-only"> la reseña «{review.title}»</span>
                        </>
                      }
                      icon={<Trash2 aria-hidden="true" />}
                      variant="ghost"
                      title="¿Eliminar esta reseña?"
                      description={`«${review.title}», de ${review.author.name ?? review.author.email}. Se borra para siempre y la calificación de ${review.product.name} se recalcula.`}
                      confirmLabel="Eliminar reseña"
                      confirmVariant="destructive"
                      action={deleteReviewAsAdminAction.bind(null, review.id)}
                    />
                  </article>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination
            path="/admin/reviews"
            params={{ q: filters.q, product: filters.product, rating: filters.rating }}
            page={page.page}
            totalPages={page.totalPages}
            total={page.total}
            noun={["reseña"]}
          />
        </div>
      )}
    </>
  );
}
