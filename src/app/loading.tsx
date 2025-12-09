import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="container-custom py-8">
      {/* Hero skeleton */}
      <Skeleton className="h-[400px] w-full rounded-2xl mb-8" />

      {/* Product grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl overflow-hidden border border-border">
            <Skeleton className="aspect-square" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
