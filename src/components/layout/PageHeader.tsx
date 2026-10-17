import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui";

interface PageHeaderProps {
  title: string;
  /** Id of the h1 (pages move focus to it, e.g. after emptying a list). */
  titleId?: string;
  /** Trail after "Inicio"; defaults to the page title alone. */
  breadcrumbs?: BreadcrumbItem[];
  /** Line under the title (counts, hints). */
  description?: ReactNode;
  /** Page-level actions, on the right from sm up. */
  actions?: ReactNode;
}

/**
 * Shared header of the store pages (cart, wishlist, compare): breadcrumbs,
 * then the h1 with an optional description, and actions on the right.
 * The h1 takes focus programmatically (tabIndex -1) but is not a tab stop.
 */
export function PageHeader({ title, titleId, breadcrumbs, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 md:mb-8">
      <Breadcrumbs items={breadcrumbs ?? [{ label: title }]} className="pt-0" />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 id={titleId} tabIndex={-1} className="text-headline outline-none">
            {title}
          </h1>
          {description ? <div className="mt-1 text-fg-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{actions}</div> : null}
      </div>
    </header>
  );
}
