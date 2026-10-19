import { redirect } from "next/navigation";

/**
 * /admin/cupones[/…]: the admin's sections live under English paths
 * (/admin/products, /admin/orders…); the coupons section's Spanish name leads
 * to /admin/coupons too. A redirect from the page (not next.config's
 * redirects) so a client-side navigation also ends on the real URL.
 */
export default async function CuponesAlias({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest = [] } = await params;
  redirect(["/admin/coupons", ...rest.map(encodeURIComponent)].join("/"));
}
