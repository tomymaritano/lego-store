import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { saveProductAction } from "@/lib/admin/actions";
import { getProductFormOptions } from "@/lib/admin/data";
import { PageHeader } from "@/components/layout/PageHeader";
import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/ProductForm";

export const metadata: Metadata = {
  title: "Nuevo producto · Administración",
};

/** /admin/products/new: a product from scratch; saving it opens its edit page. */
export default async function NewProductPage() {
  await requireAdmin({ callbackUrl: "/admin/products/new" });
  const options = await getProductFormOptions();
  return (
    <>
      <PageHeader
        title="Nuevo producto"
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Productos", href: "/admin/products" },
          { label: "Nuevo producto" },
        ]}
        description="Se publica en la tienda apenas lo crees."
      />
      <ProductForm
        mode="create"
        action={saveProductAction.bind(null, null)}
        initial={EMPTY_PRODUCT}
        categories={options.categories}
        themes={options.themes}
        suggestions={options.suggestions}
      />
    </>
  );
}
