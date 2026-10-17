"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

interface ErrorProps {
  error: unknown;
  /** Re-fetches and re-renders the segment (Next 16.4+). */
  retry: () => void;
}

/** Route-level error boundary: the shell (Navbar, Footer) stays usable. */
export default function Error({ error, retry }: ErrorProps) {
  const details = error instanceof globalThis.Error ? (error as Error & { digest?: string }) : null;

  useEffect(() => {
    // Hook for an error-reporting service (Sentry, etc.) once there is one.
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="container-custom flex min-h-[60vh] flex-col items-center justify-center py-16">
      <EmptyState
        headingLevel="h1"
        icon={<AlertTriangle />}
        title="Algo salió mal"
        description="Tuvimos un problema al cargar esta página. Puedes intentarlo de nuevo o volver al inicio; tu carrito sigue a salvo."
        action={
          <>
            <Button size="lg" onClick={() => retry()}>
              <RefreshCw aria-hidden="true" />
              Intentar de nuevo
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/" />}>
              <Home aria-hidden="true" />
              Ir al inicio
            </Button>
          </>
        }
      />

      {process.env.NODE_ENV === "development" && details ? (
        <pre className="mt-4 max-w-xl overflow-x-auto rounded-xl border border-border bg-bg-subtle p-4 text-left text-caption whitespace-pre-wrap text-danger">
          {details.message}
          {details.digest ? `\nID: ${details.digest}` : null}
        </pre>
      ) : details?.digest ? (
        <p className="mt-2 text-caption text-fg-muted">Código de error: {details.digest}</p>
      ) : null}
    </div>
  );
}
