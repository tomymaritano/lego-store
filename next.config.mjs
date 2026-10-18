import { blobPublicHostname } from "./src/lib/blob-host.mjs";

/**
 * Sent on every response. No page of ours is ever framed (the Stripe Payment
 * Element frames js.stripe.com inside our pages, not the other way round), so
 * framing is denied everywhere: this blocks clickjacking of /admin and
 * /account. HSTS only in production: `next dev` and the e2e server run on
 * plain http://localhost.
 *
 * The CSP also turns off plugins (object-src) and <base> hijacking of relative
 * URLs (base-uri), which nothing here uses. A script-src allow-list needs
 * per-request nonces (proxy.ts) for Next's inline scripts, Stripe and Google
 * sign-in: not done yet (docs/backend.md, "Headers de seguridad y dependencias").
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

/** This store's own Vercel Blob host (src/lib/blob-host.mjs), or null without one. */
const blobHost = blobPublicHostname(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // src/lib/images.ts (client code included) reads the Blob host from here, never the token.
  env: { BLOB_PUBLIC_HOSTNAME: blobHost ?? "" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Playwright's production server builds into its own folder (NEXT_DIST_DIR,
  // see playwright.config.ts) so `next build` never rewrites the .next folder
  // the dev server is reading at the same time.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // That e2e build only serves the browser tests. A `next dev` already running
  // rewrites .next/dev/types and next-env.d.ts while it builds, which once failed
  // its type check with half-written files; `tsc --noEmit` (CI's lint job, and
  // every other build) checks the types.
  typescript: { ignoreBuildErrors: process.env.NEXT_DIST_DIR === ".next-e2e" },
  // Pin the workspace root: a stray package-lock.json in the user's home
  // directory otherwise makes Turbopack guess the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // forbidden() (src/lib/auth/session.ts requireAdmin): a real 403 with src/app/forbidden.tsx.
    authInterrupts: true,
  },
  images: {
    // AVIF first (noticeably smaller than WebP for the set renders), WebP as
    // the fallback. Optimised variants are cached, so the slower AVIF encode
    // is paid once per size.
    formats: ["image/avif", "image/webp"],
    // Keep equal to remoteImagePatterns() (src/lib/images.ts): the lego.com CDN
    // of the seed's pictures, and this store's own Vercel Blob store (only
    // its uploads/ folder) for the admin's uploads, never every Blob store.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.lego.com",
        pathname: "/cdn/**",
      },
      ...(blobHost ? [{ protocol: "https", hostname: blobHost, pathname: "/uploads/**" }] : []),
    ],
  },
};

export default nextConfig;
