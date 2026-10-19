/*
 * The servers the e2e suite runs against (playwright.config.ts). The ports can
 * be moved so two checkouts, or a run and a hand-started server, do not share
 * them: Playwright reuses whatever already listens there outside CI.
 */

function port(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) throw new Error(`${name} tiene que ser un puerto (1-65535), no "${raw}".`);
  return value;
}

/** `next dev` with the mock payment gateway (the chromium project). */
export const E2E_DEV_PORT = port("E2E_DEV_PORT", 3000);
/** `next build` + `next start` (the prod project). */
export const E2E_PROD_PORT = port("E2E_PROD_PORT", 3100);
/** Build folder of the production server, apart from `next dev`'s .next. */
export const E2E_PROD_DIST_DIR = ".next-e2e";
