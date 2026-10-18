import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { saveCategoryAction } from "@/lib/admin/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryForm, EMPTY_CATEGORY } from "@/components/admin/CategoryForm";

export const metadata: Metadata = {
  title: "Nueva categoría · Administración",
};

/** /admin/categories/new: a category from scratch, last in the order; saving it opens its page. */
export default async function NewCategoryPage() {
  await requireAdmin({ callbackUrl: "/admin/categories/new" });
  return (
    <>
      <PageHeader
        title="Nueva categoría"
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Categorías", href: "/admin/categories" },
          { label: "Nueva categoría" },
        ]}
        description="Aparece en la tienda apenas la crees (si queda visible), al final del orden."
      />
      <div className="max-w-3xl">
        <CategoryForm mode="create" action={saveCategoryAction.bind(null, null)} initial={EMPTY_CATEGORY} />
      </div>
    </>
  );
}
