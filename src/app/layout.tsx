import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { CategoriesProvider } from "@/providers/CategoriesProvider";
import { ViewerProvider } from "@/providers/ViewerProvider";
import { ShippingRulesProvider } from "@/providers/ShippingRulesProvider";
import { ClientProviders, Footer, Navbar } from "@/components/layout";
import { Toaster } from "@/components/ui";
import { getCategories, getCategoryNames, getThemes } from "@/lib/api";
import { themeNavItems } from "@/config/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/settings";
import { configuredProvider } from "@/lib/payments/config";
import { PAYMENT_METHOD_BADGES } from "@/lib/payments/methods";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { siteConfig } from "@/config/site";

// Self-hosted by next/font: no render-blocking request to Google, preloaded
// woff2 and a size-adjusted fallback. Only the weights the type scale uses
// (regular to extrabold). `optional`: the text paints once, in its final
// font, instead of repainting on a late swap (the hero copy is the LCP
// element); on a cold, slow load the metric-matched fallback stays.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "optional",
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.seo.defaultTitle,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.seo.keywords],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.seo.defaultTitle,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.seo.defaultTitle,
    description: siteConfig.description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffd44a" },
    { media: "(prefers-color-scheme: dark)", color: "#171412" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The session makes every page render per request (see docs/architecture.md, «Renderizado y caché»); the
  // catalogue reads stay in the data cache, so this costs one session check and one query.
  const [categories, categoryNames, themes, user, settings] = await Promise.all([
    getCategories().then((list) => list.map(({ id, name }) => ({ id, name }))),
    // Hidden categories too: their products still show the category's name.
    getCategoryNames(),
    getThemes().then(themeNavItems),
    getCurrentUser(),
    // The admin's settings (announcement bar, footer, the cart's shipping rule), cached under the "settings" tag.
    getStoreSettings(),
  ]);
  const account = user ? { name: user.name, email: user.email, role: user.role } : null;
  const viewer = user ? { id: user.id, name: user.name } : null;

  return (
    <html lang="es-AR" className={`${barlow.variable} motion-safe:scroll-smooth`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint (no light/dark flash). See lib/theme.ts. */}
        <ThemeScript />
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-fg antialiased">
        <a
          href="#main-content"
          className="sr-only rounded-lg bg-primary px-4 py-2 font-bold text-on-primary shadow-lg focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-100"
        >
          Saltar al contenido principal
        </a>
        <QueryProvider>
          <CategoriesProvider categories={categoryNames}>
            <ViewerProvider viewer={viewer}>
              <ShippingRulesProvider rules={settings.shipping}>
                <ClientProviders>
                  <Navbar categories={categories} themes={themes} account={account} settings={settings} />
                  <main id="main-content" className="flex-1 outline-none" tabIndex={-1}>
                    {children}
                  </main>
                  <Footer categories={categories} themes={themes} settings={settings} paymentMethods={PAYMENT_METHOD_BADGES[configuredProvider()]} />
                  <Toaster />
                </ClientProviders>
              </ShippingRulesProvider>
            </ViewerProvider>
          </CategoriesProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
