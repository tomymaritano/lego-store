import { redirect } from "next/navigation";

/**
 * /admin/auditoria: the audit log lives at /admin/audit, like the other
 * sections' English paths (see /admin/cupones). The filters come along.
 */
export default async function AuditoriaAlias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const search = query.toString();
  redirect(search ? `/admin/audit?${search}` : "/admin/audit");
}
