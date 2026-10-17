import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { CategoriesProvider } from "@/providers/CategoriesProvider";
import { ClientProviders, Footer, Navbar } from "@/components/layout";
import { Toaster } from "@/components/ui";
import { getCategories } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { THEME_SCRIPT } from "@/lib/theme";
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
  // The session makes every page render per request (see README, «Rendimiento»); the
  // catalogue reads stay in the data cache, so this costs one session check and one query.
  const [categories, user] = await Promise.all([
    getCategories().then((list) => list.map(({ id, name }) => ({ id, name }))),
    getCurrentUser(),
  ]);
  const account = user ? { name: user.name, email: user.email, role: user.role } : null;

  return (
    <html lang="es-AR" className={`${barlow.variable} motion-safe:scroll-smooth`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint (no light/dark flash). See lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-fg antialiased">
        <a
          href="#main-content"
          className="sr-only rounded-lg bg-primary px-4 py-2 font-bold text-on-primary shadow-lg focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-100"
        >
          Saltar al contenido principal
        </a>
        <QueryProvider>
          <CategoriesProvider categories={categories}>
            <ClientProviders>
              <Navbar categories={categories} account={account} />
              <main id="main-content" className="flex-1 outline-none" tabIndex={-1}>
                {children}
              </main>
              <Footer categories={categories} />
              <Toaster />
            </ClientProviders>
          </CategoriesProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
