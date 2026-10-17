import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { CategoriesProvider } from "@/providers/CategoriesProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ClientProviders } from "@/components/layout";
import { Toaster } from "@/components/ui";
import { getCategories } from "@/lib/api";
import { THEME_SCRIPT } from "@/lib/theme";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: {
    default: siteConfig.seo.defaultTitle,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.seo.keywords],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  robots: { index: true, follow: true },
  openGraph: {
    title: `${siteConfig.name} | Tienda Oficial`,
    description: "La mejor tienda de sets LEGO. Encuentra tu próxima construcción.",
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | Tienda Oficial`,
    description: "La mejor tienda de sets LEGO",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffd44a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = (await getCategories()).map(({ id, name }) => ({ id, name }));

  return (
    <html lang="es" className="scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint (no light/dark flash). See lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-fg antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-bold focus:text-on-primary focus:shadow-lg"
        >
          Saltar al contenido principal
        </a>
        <QueryProvider>
          <CategoriesProvider categories={categories}>
            <ClientProviders>
              <Navbar categories={categories} />
              <main id="main-content" className="flex-1" tabIndex={-1}>
                {children}
              </main>
              <Footer />
              <Toaster />
            </ClientProviders>
          </CategoriesProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
