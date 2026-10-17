import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  /** Trail after "Inicio". The last item is the current page. */
  items: BreadcrumbItem[];
  className?: string;
}

const linkClasses =
  "rounded-sm text-fg-muted transition-colors duration-fast hover:text-fg hover:underline underline-offset-4";

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Ruta de navegación" className={cn("py-4", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        <li className="flex items-center">
          <Link href="/" className={cn(linkClasses, "flex items-center gap-1")}>
            <Home aria-hidden="true" className="size-4" />
            <span className="sr-only">Inicio</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center">
              <ChevronRight aria-hidden="true" className="mx-1 size-4 text-fg-muted" />
              {item.href && !isCurrent ? (
                <Link href={item.href} className={linkClasses}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined} className="font-medium text-fg">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
