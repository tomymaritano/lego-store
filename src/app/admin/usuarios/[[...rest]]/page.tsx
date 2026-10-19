import { redirect } from "next/navigation";

/** /admin/usuarios[/…]: the users section lives at /admin/users (see /admin/cupones). */
export default async function UsuariosAlias({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest = [] } = await params;
  redirect(["/admin/users", ...rest.map(encodeURIComponent)].join("/"));
}
