import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import {
  saveAnnouncementSettingsAction,
  saveContactSettingsAction,
  saveFeaturedProductsAction,
  saveShippingSettingsAction,
} from "@/lib/admin/actions";
import { getAdminSettingsPage } from "@/lib/admin/data";
import { SETTINGS_ENTITY_ID } from "@/lib/admin/settings";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { FeaturedProductsEditor } from "@/components/admin/FeaturedProductsEditor";
import { AnnouncementSettingsForm, ContactSettingsForm, PlaceholderList, ShippingSettingsForm } from "@/components/admin/SettingsForms";
import { Card, CardContent, CardHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Configuración · Administración",
};

const SECTIONS = [
  { id: "settings-shipping", label: "Envío" },
  { id: "settings-announcement", label: "Barra de anuncio" },
  { id: "settings-contact", label: "Contacto y redes" },
  { id: "settings-featured", label: "Destacados de la home" },
];

/**
 * /admin/configuracion: the store's settings, one form per section (each
 * saves on its own, validated on the server and recorded in the audit log),
 * the placeholders the texts understand, and the settings' history.
 */
export default async function AdminSettingsPage() {
  await requireAdmin({ callbackUrl: "/admin/configuracion" });
  const { settings, saved, featured, productOptions, history } = await getAdminSettingsPage();

  return (
    <>
      <PageHeader
        title="Configuración"
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Configuración" }]}
        description={
          saved
            ? "Envío, barra de anuncio, contacto y destacados de la home. Cada sección se guarda por separado."
            : "La tienda usa los valores iniciales: se guardan la primera vez que cambies una sección."
        }
      />

      <nav aria-label="Secciones de la configuración" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 text-label font-medium text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="min-w-0 space-y-6">
          <ShippingSettingsForm action={saveShippingSettingsAction} initial={settings.shipping} />
          <AnnouncementSettingsForm action={saveAnnouncementSettingsAction} initial={settings} />
          <ContactSettingsForm action={saveContactSettingsAction} initial={settings} />
          <FeaturedProductsEditor initial={featured} options={productOptions} action={saveFeaturedProductsAction} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-title text-fg">Valores para los textos</h2>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <p className="text-label font-normal text-fg-secondary">
                Escríbelos en la barra de anuncio o en las páginas de contenido y se reemplazan por el valor actual:
              </p>
              <PlaceholderList settings={settings} />
            </CardContent>
          </Card>
          <AuditHistory entries={history} entity={{ type: "settings", id: SETTINGS_ENTITY_ID }} />
        </div>
      </div>
    </>
  );
}
