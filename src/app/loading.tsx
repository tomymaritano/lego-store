import { ProductListSkeleton, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="container-custom py-8" aria-busy="true">
      <p className="sr-only" role="status">
        Cargando…
      </p>
      <Skeleton className="mb-8 h-72 w-full rounded-2xl md:h-96" />
      <ProductListSkeleton count={8} />
    </div>
  );
}
