import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { discardContentDraftAction, publishContentAction, saveContentDraftAction } from "@/lib/admin/actions";
import { CONTENT_STATUS_LABELS } from "@/lib/admin/content";
import { getAdminContentDetail } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";
import { CONTENT_PAGES, isContentSlug } from "@/lib/content/pages";
import { getStoreSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { PlaceholderList } from "@/components/admin/SettingsForms";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";

type ContentPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ContentPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${isContentSlug(slug) ? CONTENT_PAGES[slug].label : "Contenido"} · Administración` };
}

/** /admin/contenido/<slug>: the page's editor with its preview, what the page adds on its own, the placeholders and the history. */
export default async function AdminContentEditPage({ params }: ContentPageProps) {
  const { slug } = await params;
  await requireAdmin({ callbackUrl: `/admin/contenido/${encodeURIComponent(slug)}` });
  if (!isContentSlug(slug)) notFound();
  const [page, settings] = await Promise.all([getAdminContentDetail(slug), getStoreSettings()]);
  const info = CONTENT_PAGES[slug];

  return (
    <>
      <PageHeader
        title={page.label}
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Contenido", href: "/admin/contenido" }, { label: page.label }]}
        description={
          <span>
            {CONTENT_STATUS_LABELS[page.status]}
            {page.publishedAt ? ` · publicada el ${formatAdminDateTime(page.publishedAt)}${page.publishedByEmail ? ` por ${page.publishedByEmail}` : ""}` : ""}
          </span>
        }
        actions={
          <Button render={<Link href={info.path} target="_blank" rel="noopener" />} variant="secondary" size="sm">
            <ExternalLink aria-hidden="true" />
            Ver página<span className="sr-only"> (se abre en otra pestaña)</span>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <ContentEditor
          page={info}
          initial={page.draft}
          published={page.published}
          settings={settings}
          save={saveContentDraftAction}
          publish={publishContentAction}
          discard={discardContentDraftAction}
        />
        <div className="space-y-6">
          {info.note ? (
            <Card>
              <CardHeader>
                <h2 className="text-title text-fg">Lo que agrega la página</h2>
              </CardHeader>
              <CardContent className="pt-3 text-label font-normal text-fg-secondary">{info.note}</CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <h2 className="text-title text-fg">Valores para los textos</h2>
            </CardHeader>
            <CardContent className="pt-4">
              <PlaceholderList settings={settings} />
            </CardContent>
          </Card>
          <AuditHistory entries={page.history} entity={{ type: "content", id: slug }} />
        </div>
      </div>
    </>
  );
}
