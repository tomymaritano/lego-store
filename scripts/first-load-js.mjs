// First-load JS budget: gzipped size of every <script src> a route's HTML
// loads (what Next 15 printed as "First Load JS"; Next 16 no longer does).
// noModule polyfills are skipped: modern browsers never download them.
//
//   npm run build && npm run start -- -p 3311
//   npm run size -- http://localhost:3311
//
// Exits 1 when a route goes over its budget. Budgets sit ~5% above the sizes
// measured when they were last lowered (Oct 2026, UI overhaul: / 251 kB,
// product 282 kB, catalogue 314 kB, checkout 306 kB, after Sonner and the
// product reviews moved out of first load): a regression guard, not a target.
// Lower them as you trim. With the backend (accounts, list sync, account menu)
// the same routes measure / 255 kB, product 287 kB, catalogue 320 kB, checkout
// 314 kB; every page now renders per request (the layout reads the session),
// which does not change these numbers. Root-layout client code must not import
// zod at runtime (ESLint guards it): that alone added ~30 kB to every route.
//
// Pre-overhaul (Next 15) printed 181-197 kB. That floor is out of reach
// without dropping Motion: React 19 + the Next 16 runtime alone are ~131 kB,
// and Motion's `m` core ~45 kB (its feature bundle loads on demand). Not
// strictly comparable either: this counts every script tag.
import { gzipSync } from "node:zlib";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
/** kB of gzipped JS per route. */
const BUDGETS = {
  "/": 265,
  "/item/1": 296,
  "/category/helmet": 330,
  "/search?q=star": 330,
  "/cart": 262,
  "/wishlist": 262,
  "/compare": 264,
  "/checkout": 322,
};

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await fetch(BASE_URL);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`No server at ${BASE_URL}`);
}

await waitForServer();
const gzipped = new Map();
let failed = false;
for (const [route, budget] of Object.entries(BUDGETS)) {
  const html = await (await fetch(BASE_URL + route)).text();
  const sources = [
    ...new Set(
      [...html.matchAll(/<script\b([^>]*)>/g)]
        .map(([, attrs]) => attrs)
        .filter((attrs) => !/\bnomodule\b/i.test(attrs))
        .map((attrs) => attrs.match(/\bsrc="([^"]+)"/)?.[1])
        .filter(Boolean)
    ),
  ];
  let bytes = 0;
  for (const src of sources) {
    if (!gzipped.has(src)) {
      const body = Buffer.from(await (await fetch(new URL(src, BASE_URL))).arrayBuffer());
      gzipped.set(src, gzipSync(body, { level: 9 }).length);
    }
    bytes += gzipped.get(src);
  }
  const kb = bytes / 1024;
  const over = kb > budget;
  failed ||= over;
  console.log(
    `${over ? "✗" : "✓"} ${route.padEnd(18)} ${kb.toFixed(1).padStart(6)} / ${budget} kB gzip (${sources.length} scripts)`
  );
}
process.exit(failed ? 1 : 0);
