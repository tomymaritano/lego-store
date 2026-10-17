// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/*
 * Fixture tests for the design-system guardrails in eslint.config.mjs.
 * Each snippet is linted as if it lived in app code and in src/components/ui.
 */
const APP_FILE = "src/app/zz-guardrail-fixture/page.tsx";
const UI_FILE = "src/components/ui/ZzGuardrailFixture.tsx";

let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: process.cwd() });
});

async function guardrailHits(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax");
}

const jsx = (body: string) => `export function Zz({ index }: { index: number }) {\n  void index;\n  return ${body};\n}\n`;

const flagged: Array<[string, string]> = [
  ["raw palette", jsx(`<div className="bg-gray-500" />`)],
  ["white/black", jsx(`<div className="text-white" />`)],
  ["opacity black", jsx(`<div className="text-black/50" />`)],
  ["shadow-black", jsx(`<div className="shadow-black" />`)],
  ["ring-offset-white", jsx(`<div className="ring-offset-white" />`)],
  ["placeholder-black", jsx(`<input className="placeholder-black" />`)],
  ["arbitrary hex", jsx(`<div className="bg-[#ff0000]" />`)],
  ["arbitrary rgb", jsx(`<div className="bg-[rgb(255,0,0)]" />`)],
  ["arbitrary color: hex", jsx(`<div className="text-[color:#ff0000]" />`)],
  ["arbitrary oklch", jsx(`<div className="bg-[oklch(0.7_0.1_90)]" />`)],
  ["inline style hex", jsx(`<div style={{ color: "#ff0000" }} />`)],
  ["inline style rgb", jsx(`<div style={{ backgroundColor: "rgb(0 0 0)" }} />`)],
  ["palette in template", jsx("<div className={`p-2 bg-blue-500`} />")],
  ["alias lego-*", jsx(`<span className="bg-lego-yellow text-lego-red" />`)],
  ["alias brand-*", jsx(`<span className="bg-brand-500" />`)],
  ["alias background-*", jsx(`<span className="bg-background-secondary" />`)],
  ["alias foreground", jsx(`<span className="text-foreground" />`)],
  ["alias status-*", jsx(`<span className="text-status-error" />`)],
  ["alias border-subtle", jsx(`<span className="border-border-subtle" />`)],
  ["numeric motion duration", jsx(`<div transition={{ duration: 0.6 }} />`)],
];

const clean: Array<[string, string]> = [
  ["semantic tokens", jsx(`<div className="bg-surface text-fg-muted border-border ring-focus-ring" />`)],
  ["arbitrary var()", jsx(`<div className="w-(--anchor-width) bg-[var(--primary)]" />`)],
  ["style with var()", jsx(`<div style={{ color: "var(--fg)" }} />`)],
  ["motion preset", `import { transitions } from "@/lib/motion";\n${jsx(`<div transition={transitions.fast} />`)}`],
  ["text-display token", jsx(`<h1 className="text-display" />`)],
];

describe("design-system guardrails", () => {
  describe.each([
    ["app code", APP_FILE, 1],
    ["ui primitives", UI_FILE, 2],
  ])("%s", (_scope, filePath, severity) => {
    it.each(flagged)("flags %s", async (_name, code) => {
      const hits = await guardrailHits(code, filePath);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((m) => m.severity === severity)).toBe(true);
    });

    it.each(clean)("allows %s", async (_name, code) => {
      expect(await guardrailHits(code, filePath)).toEqual([]);
    });
  });

  describe("dark: variant", () => {
    it.each([
      ["plain", `<div className="dark:bg-surface" />`],
      ["stacked md:dark:", `<div className="md:dark:bg-surface" />`],
      ["stacked hover:dark:", `<div className="p-2 hover:dark:text-fg" />`],
    ])("flags %s in app code", async (_name, body) => {
      expect((await guardrailHits(jsx(body), APP_FILE)).length).toBeGreaterThan(0);
    });

    it("is allowed in src/components/ui", async () => {
      expect(await guardrailHits(jsx(`<div className="md:dark:bg-primary" />`), UI_FILE)).toEqual([]);
    });
  });
});
