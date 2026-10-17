import { ProductListSkeleton, Skeleton } from "@/components/ui";

/** Placeholder for CatalogView: filter sidebar (desktop), toolbar and a three-column grid. */
export function CatalogSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="hidden space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-card lg:block">
        <Skeleton className="h-7 w-28" />
        {Array.from({ length: 3 }).map((_, group) => (
          <div key={group} className="space-y-3 border-t border-border pt-5 first:border-0 first:pt-0">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, row) => (
              <Skeleton key={row} className="h-5 w-40" />
            ))}
          </div>
        ))}
      </div>
      <div>
        <div className="mb-6 flex items-end justify-between gap-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-11 w-56" />
        </div>
        <ProductListSkeleton count={6} columns={3} />
      </div>
    </div>
  );
}
