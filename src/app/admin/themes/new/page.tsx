import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { saveThemeAction } from "@/lib/admin/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { EMPTY_THEME, ThemeForm } from "@/components/admin/ThemeForm";

export const metadata: Metadata = {
  title: "Nuevo tema · Administración",
};

/** /admin/themes/new: a theme from scratch, last in the order; saving it opens its page. */
export default async function NewThemePage() {
  await requireAdmin({ callbackUrl: "/admin/themes/new" });
  return (
    <>
      <PageHeader
        title="Nuevo tema"
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Temas", href: "/admin/themes" },
          { label: "Nuevo tema" },
        ]}
        description="Queda último en el menú «Temas»; los productos lo eligen en su formulario."
      />
      <div className="max-w-3xl">
        <ThemeForm mode="create" action={saveThemeAction.bind(null, null)} initial={EMPTY_THEME} />
      </div>
    </>
  );
}
