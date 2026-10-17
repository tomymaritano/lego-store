import { Skeleton } from "@/components/ui";
import { CatalogSkeleton } from "@/components/product/CatalogSkeleton";

/** Search / catalogue placeholder. */
export default function SearchLoading() {
  return (
    <div className="container-custom py-8" aria-busy="true">
      <p className="sr-only" role="status">
        Buscando productos…
      </p>
      <Skeleton className="mb-4 h-5 w-32" />
      <div className="mb-8 space-y-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-48" />
      </div>
      <CatalogSkeleton />
    </div>
  );
}
