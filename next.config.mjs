/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright's production server builds into its own folder (NEXT_DIST_DIR,
  // see playwright.config.ts) so `next build` never rewrites the .next folder
  // the dev server is reading at the same time.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.lego.com",
        pathname: "/cdn/**",
      },
    ],
  },
};

export default nextConfig;
