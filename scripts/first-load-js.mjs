// First-load JS budget: gzipped size of every <script src> a route's HTML
// loads (what Next 15 printed as "First Load JS"; Next 16 no longer does).
// noModule polyfills are skipped: modern browsers never download them.
//
//   npm run build && npm run start -- -p 3311
//   npm run size -- http://localhost:3311
//
// Exits 1 when a route goes over its budget. Budgets sit ~8% above the
// sizes measured when they were set (Oct 2026: / 260 kB, catalogue 326 kB,
// checkout 349 kB): a regression guard, not a target. Lower them as you trim.
import { gzipSync } from "node:zlib";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
/** kB of gzipped JS per route. */
const BUDGETS = {
  "/": 280,
  "/item/1": 350,
  "/category/helmet": 350,
  "/search?q=star": 350,
  "/cart": 280,
  "/wishlist": 280,
  "/compare": 285,
  "/checkout": 375,
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
