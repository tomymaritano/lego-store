import { ProductListSkeleton, Skeleton } from "@/components/ui";

/** Category placeholder: breadcrumbs, title + count, product grid. */
export default function CategoryLoading() {
  return (
    <div className="container-custom py-8" aria-busy="true">
      <p className="sr-only" role="status">
        Cargando categoría…
      </p>
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="mb-8 space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <ProductListSkeleton count={8} />
    </div>
  );
}
