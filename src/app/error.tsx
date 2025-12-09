"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // captureException(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {/* Error icon */}
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-foreground-primary mb-3">
          Algo salió mal
        </h1>
        <p className="text-foreground-muted mb-6">
          Ha ocurrido un error inesperado. Nuestro equipo ha sido notificado y
          estamos trabajando para solucionarlo.
        </p>

        {/* Error details in development */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-background-secondary rounded-lg text-left">
            <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-foreground-muted mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            Intentar de nuevo
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg">
              <Home className="w-4 h-4 mr-2" />
              Ir al inicio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
