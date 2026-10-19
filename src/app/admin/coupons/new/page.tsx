import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { saveCouponAction } from "@/lib/admin/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { CouponForm, EMPTY_COUPON } from "@/components/admin/CouponForm";

export const metadata: Metadata = {
  title: "Nuevo cupón · Administración",
};

/** /admin/coupons/new: a coupon from scratch; saving it opens its page. */
export default async function NewCouponPage() {
  await requireAdmin({ callbackUrl: "/admin/coupons/new" });
  return (
    <>
      <PageHeader
        title="Nuevo cupón"
        breadcrumbs={[
          { label: "Administración", href: "/admin" },
          { label: "Cupones", href: "/admin/coupons" },
          { label: "Nuevo cupón" },
        ]}
        description="Se puede usar apenas lo crees (si está activo y dentro de sus fechas)."
      />
      <CouponForm mode="create" action={saveCouponAction.bind(null, null)} initial={EMPTY_COUPON} />
    </>
  );
}
