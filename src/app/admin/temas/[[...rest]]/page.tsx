import { redirect } from "next/navigation";

/** /admin/temas[/…]: the section lives at /admin/themes (see /admin/cupones). */
export default async function Alias({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest = [] } = await params;
  redirect(["/admin/themes", ...rest.map(encodeURIComponent)].join("/"));
}
