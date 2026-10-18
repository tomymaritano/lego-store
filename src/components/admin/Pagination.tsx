import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { pluralize } from "@/lib/utils";

type Params = Record<string, string | number | null | undefined>;

/** `path` with the filters in `params` (empty ones dropped) and `page` (left out for page 1). */
export function pageHref(path: string, params: Params, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

interface PaginationProps {
  /** The list's path ("/admin/orders"). */
  path: string;
  /** The current filters (kept on every link). */
  params: Params;
  page: number;
  totalPages: number;
  total: number;
  /** ["pedido"] -> "1 pedido", "20 pedidos". */
  noun: [singular: string, plural?: string];
}

/** "Página 2 de 5 · 87 pedidos" with previous / next links (plain links: works without JavaScript). */
export function Pagination({ path, params, page, totalPages, total, noun }: PaginationProps) {
  const step = (target: number, label: string, icon: ReactNode, iconAfter: boolean, disabled: boolean) => {
    const content = iconAfter ? (
      <>
        {label}
        {icon}
      </>
    ) : (
      <>
        {icon}
        {label}
      </>
    );
    return disabled ? (
      <Button variant="secondary" size="sm" disabled>
        {content}
      </Button>
    ) : (
      <Button render={<Link href={pageHref(path, params, target)} prefetch={false} />} variant="secondary" size="sm">
        {content}
      </Button>
    );
  };
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-label font-normal text-fg-secondary">
        Página {page} de {totalPages} · {pluralize(total, noun[0], noun[1])}
      </p>
      {totalPages > 1 ? (
        <div className="flex gap-2">
          {step(page - 1, "Anterior", <ChevronLeft aria-hidden="true" />, false, page <= 1)}
          {step(page + 1, "Siguiente", <ChevronRight aria-hidden="true" />, true, page >= totalPages)}
        </div>
      ) : null}
    </nav>
  );
}
