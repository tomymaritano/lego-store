import { Download } from "lucide-react";
import { Button } from "@/components/ui";

interface ExportButtonProps {
  kind: "orders" | "customers" | "newsletter";
  /** The list's current filters: the export has the same rows (every page). */
  params: Record<string, string>;
  label?: string;
}

/** "Exportar CSV": a download link to /api/admin/export/<kind> with the list's filters (the route checks the admin and audits it). */
export function ExportButton({ kind, params, label = "Exportar CSV" }: ExportButtonProps) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "")).toString();
  const href = `/api/admin/export/${kind}${query ? `?${query}` : ""}`;
  return (
    <Button render={<a href={href} download />} variant="secondary" size="sm" data-testid={`export-${kind}`}>
      <Download aria-hidden="true" />
      {label}
    </Button>
  );
}
