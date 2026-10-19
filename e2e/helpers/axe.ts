import path from "node:path";
import type { Page } from "@playwright/test";

/** axe-core is a declared dev dependency (package.json), injected from node_modules. */
const AXE_PATH = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

/**
 * Runs axe (WCAG 2.1 A/AA + best practices) on the page and returns the
 * serious/critical violations as "rule :: selectors" strings. Entrance
 * animations fade content in, so call it through `expect.poll` until the
 * page has settled.
 */
export async function seriousAxeViolations(page: Page): Promise<string[]> {
  return axeViolations(page, (violation) => violation.impact === "serious" || violation.impact === "critical");
}

/**
 * The violations of these axe rules, whatever their impact: for moderate
 * ones (landmark-unique, heading-order…) a page is known to pass.
 */
export async function axeRuleViolations(page: Page, rules: string[]): Promise<string[]> {
  return axeViolations(page, (violation) => rules.includes(violation.id));
}

async function axeViolations(page: Page, keep: (violation: { id: string; impact: string }) => boolean): Promise<string[]> {
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async (tags) => {
    type Result = { violations: { id: string; impact: string; nodes: { target: string[] }[] }[] };
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<Result> } }).axe;
    const { violations } = await axe.run(document, { runOnly: { type: "tag", values: tags } });
    return violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(" ")).join(", ") }));
  }, WCAG_TAGS);
  return violations.filter(keep).map((v) => `${v.id} :: ${v.targets}`);
}
