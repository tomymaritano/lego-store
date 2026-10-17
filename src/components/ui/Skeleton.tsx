import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Loading placeholder with a single shimmer animation (disabled by the global
 * reduced-motion rule). Decorative: announce loading on the container instead
 * (aria-busy or a visually hidden "Cargando…").
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-lg bg-linear-to-r/srgb from-bg-muted via-bg-subtle to-bg-muted bg-size-[200%_100%]",
        className
      )}
      {...props}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden shadow-md border border-border">
      <div className="aspect-square bg-bg-subtle relative">
        <Skeleton className="absolute inset-6 rounded-xl" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-1 pt-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-4 rounded-full" />
          ))}
          <Skeleton className="h-3 w-8 ml-2" />
        </div>
        <div className="flex justify-between items-end pt-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

/** Grid of card skeletons matching ProductGrid's columns. */
export function ProductListSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: 3 | 4 }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3", columns === 4 && "xl:grid-cols-4")}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
