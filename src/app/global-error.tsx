"use client";

import "./globals.css";
import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { THEME_SCRIPT } from "@/lib/theme";
import { Button, EmptyState } from "@/components/ui";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so it brings its own <html>/<body>, the global styles and
 * the theme script (dark mode), and links home with a plain <a> (full reload).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <title>Algo salió mal | LEGO Store</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen items-center justify-center bg-bg px-4 text-fg antialiased">
        <main>
          <EmptyState
            headingLevel="h1"
            icon={<AlertTriangle />}
            title="La tienda no pudo cargar"
            description="Ocurrió un error inesperado. Vuelve a intentarlo en unos segundos."
            action={
              <>
                <Button size="lg" onClick={() => retry()}>
                  <RefreshCw aria-hidden="true" />
                  Reintentar
                </Button>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the app shell is down: force a full reload. */}
                <Button size="lg" variant="outline" render={<a href="/" />}>
                  <Home aria-hidden="true" />
                  Ir al inicio
                </Button>
              </>
            }
          />
        </main>
      </body>
    </html>
  );
}
