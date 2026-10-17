import { ProductListSkeleton, Skeleton } from "@/components/ui";

/** Product page placeholder: gallery + purchase column, then related products. */
export default function ItemLoading() {
  return (
    <div className="container-custom py-6" aria-busy="true">
      <p className="sr-only" role="status">
        Cargando producto…
      </p>
      <Skeleton className="mb-4 h-5 w-64" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="size-20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-9 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="mt-16 mb-6 h-7 w-56" />
      <ProductListSkeleton count={4} />
    </div>
  );
}
