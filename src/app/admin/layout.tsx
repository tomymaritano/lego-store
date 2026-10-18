import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Shell of the admin panel: the sections' nav beside (large screens) or above
 * (phones) the page. Every page and Server Action under /admin checks the
 * admin itself (requireAdmin, src/lib/admin/data.ts); this layout only
 * decides whether to show the nav, so a customer sent to the 403 page never
 * sees the panel's sections.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="container-custom py-8 md:py-12">
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        {user?.role === "ADMIN" ? <AdminNav /> : null}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
