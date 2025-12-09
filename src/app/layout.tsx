import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ClientProviders } from "@/components/layout";
import { Toaster } from "@/components/ui";

export const metadata: Metadata = {
  title: {
    default: "LEGO Store | Tienda Oficial de Sets LEGO",
    template: "%s | LEGO Store",
  },
  description: "La mejor tienda de sets LEGO. Encuentra helmets, brickheadz, vehículos y coleccionables de Star Wars, Marvel, Disney y más.",
  keywords: ["LEGO", "tienda", "sets", "coleccionables", "Star Wars", "Marvel", "Disney", "Harry Potter", "helmets", "brickheadz"],
  authors: [{ name: "LEGO Store" }],
  creator: "LEGO Store",
  publisher: "LEGO Store",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "LEGO Store | Tienda Oficial",
    description: "La mejor tienda de sets LEGO. Encuentra tu próxima construcción.",
    type: "website",
    locale: "es_MX",
    siteName: "LEGO Store",
  },
  twitter: {
    card: "summary_large_image",
    title: "LEGO Store | Tienda Oficial",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased bg-background-primary text-foreground-primary transition-colors">
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-lego-yellow focus:text-lego-black focus:rounded-lg focus:font-bold focus:shadow-lg"
        >
          Saltar al contenido principal
        </a>
        <QueryProvider>
          <ClientProviders />
          <Navbar />
          <main id="main-content" className="flex-1" role="main" tabIndex={-1}>{children}</main>
          <Footer />
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
