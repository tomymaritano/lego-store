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
  images: {
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
