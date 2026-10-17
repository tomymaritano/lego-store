import { ProductListSkeleton, Skeleton } from "@/components/ui";

/** Home (and fallback) placeholder: hero banner + product grid. */
export default function Loading() {
  return (
    <div className="container-custom py-8" aria-busy="true">
      <p className="sr-only" role="status">
        Cargando…
      </p>
      <Skeleton className="mb-12 h-72 w-full rounded-2xl md:h-96" />
      <Skeleton className="mb-6 h-8 w-64" />
      <ProductListSkeleton count={8} />
    </div>
  );
}
