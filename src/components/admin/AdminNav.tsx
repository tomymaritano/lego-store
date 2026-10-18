"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderTree, Inbox, LayoutDashboard, Mail, MessageSquareText, Package, ReceiptText, ScrollText, Settings, Tags, TicketPercent, Users } from "lucide-react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Productos", icon: Package, exact: false },
  { href: "/admin/categories", label: "Categorías", icon: FolderTree, exact: false },
  { href: "/admin/themes", label: "Temas", icon: Tags, exact: false },
  { href: "/admin/orders", label: "Pedidos", icon: ReceiptText, exact: false },
  { href: "/admin/reviews", label: "Reseñas", icon: MessageSquareText, exact: false },
  { href: "/admin/coupons", label: "Cupones", icon: TicketPercent, exact: false },
  { href: "/admin/users", label: "Usuarios", icon: Users, exact: false },
  { href: "/admin/mensajes", label: "Mensajes", icon: Inbox, exact: false },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail, exact: false },
  { href: "/admin/contenido", label: "Contenido", icon: FileText, exact: false },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, exact: false },
  { href: "/admin/audit", label: "Auditoría", icon: ScrollText, exact: false },
] as const;

const isCurrent = (pathname: string, href: string, exact: boolean) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/**
 * The admin panel's sections: a sticky column beside the content on large
 * screens, a row above it on tablets, a two-column grid on phones (a single row
 * would cut off the last section at 390px; an odd last one spans the row). The current
 * section carries aria-current="page". No prefetch, like the other links to
 * /admin (README, "La sesión no se renueva sola").
 */
export function AdminNav() {
  // Null outside the App Router (Storybook).
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Administración" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="grid grid-cols-2 gap-1 sm:flex sm:overflow-x-auto sm:pb-1 lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:border-border lg:bg-bg-subtle lg:p-3 lg:pb-3">
        {ADMIN_NAV.map(({ href, label, icon: Icon, exact }) => (
          <li key={href} className="shrink-0 last:odd:col-span-2">
            <Link
              href={href}
              prefetch={false}
              aria-current={isCurrent(pathname, href, exact) ? "page" : undefined}
              className="flex min-h-11 items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-label font-medium whitespace-nowrap text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg aria-[current=page]:border-border aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-sm"
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
