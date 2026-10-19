import { redirect } from "next/navigation";

/** /admin/categorias[/…]: the section lives at /admin/categories (see /admin/cupones). */
export default async function Alias({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest = [] } = await params;
  redirect(["/admin/categories", ...rest.map(encodeURIComponent)].join("/"));
}
