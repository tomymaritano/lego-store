import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { CONTENT_STATUS_LABELS } from "@/lib/admin/content";
import { getAdminContentList } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Contenido · Administración",
};

const STATUS_BADGE = { published: "success", changed: "warning", unpublished: "neutral" } as const;

/** /admin/contenido: the info pages whose text the admin edits, with their status and last publication. */
export default async function AdminContentPage() {
  await requireAdmin({ callbackUrl: "/admin/contenido" });
  const pages = await getAdminContentList();

  return (
    <>
      <PageHeader
        title="Contenido"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Contenido" }]}
        description="Las páginas de ayuda, de la tienda y legales. Edita un borrador, mira la vista previa y publícalo cuando esté listo."
      />
      <Table label="Páginas de contenido" data-testid="admin-content">
        <TableHeader>
          <TableRow>
            <TableHead>Página</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Publicada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow key={page.slug} data-testid="admin-content-row">
              <TableCell>
                <Link href={`/admin/contenido/${page.slug}`} prefetch={false} className="font-medium text-fg underline-offset-4 hover:underline">
                  {page.label}
                </Link>
                <span className="block font-mono text-caption text-fg-muted">{page.path}</span>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE[page.status]}>{CONTENT_STATUS_LABELS[page.status]}</Badge>
              </TableCell>
              <TableCell className="hidden text-fg-secondary md:table-cell">
                {page.publishedAt ? (
                  <>
                    <span className="whitespace-nowrap">{formatAdminDateTime(page.publishedAt)}</span>
                    {page.publishedByEmail ? <span className="block truncate text-caption text-fg-muted">{page.publishedByEmail}</span> : null}
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
