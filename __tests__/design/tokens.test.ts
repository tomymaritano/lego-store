import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { duration } from "@/lib/motion";

/**
 * Guards the design tokens in globals.css:
 * - WCAG AA contrast for every text/background and on-colour pair, light and dark
 * - 3:1 for focus ring, strong borders and rating stars (non-text UI)
 * - motion durations in CSS and @/lib/motion stay in sync
 */

const css = fs.readFileSync(path.resolve(__dirname, "../../src/app/globals.css"), "utf8");

function declarations(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.:]/g, (m) => `\\${m}`);
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g");
  const out: Record<string, string> = {};
  for (const match of css.matchAll(block)) {
    for (const decl of match[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[decl[1]] = decl[2].trim();
  }
  return out;
}

const light = declarations(":root");
const dark = { ...light, ...declarations(".dark") };

function resolve(vars: Record<string, string>, name: string): string {
  let value = vars[name];
  for (let i = 0; i < 10 && value?.startsWith("var("); i++) value = vars[value.slice(6, -1)];
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`--${name} does not resolve to a hex colour (${value})`);
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;
const surfaces = ["bg", "bg-subtle", "bg-muted", "surface", "surface-raised"];
const pairs: Array<[string, string, number]> = [
  ...["fg", "fg-secondary", "fg-muted"].flatMap((fg) => surfaces.map((s): [string, string, number] => [fg, s, TEXT])),
  ["on-primary", "primary", TEXT],
  ["on-primary", "primary-hover", TEXT],
  ...["danger", "success", "warning", "info", "sale"].flatMap((c): Array<[string, string, number]> => [
    [`on-${c}`, c, TEXT],
    [c, "bg", TEXT],
    [c, "bg-subtle", TEXT],
    [c, "surface", TEXT],
  ]),
  ["on-badge-sale", "badge-sale", TEXT],
  ["on-badge-new", "badge-new", TEXT],
  ["on-badge-limited", "badge-limited", TEXT],
  ["on-badge-exclusive", "badge-exclusive", TEXT],
  ["fg", "badge-neutral", TEXT],
  ["on-brand-red", "brand-red", TEXT],
  ["brand-red", "primary", UI],
  ["on-info-surface", "info-surface", TEXT],
  ...surfaces.map((s): [string, string, number] => ["focus-ring", s, UI]),
  ["border-strong", "bg", UI],
  ["border-strong", "surface", UI],
  ["rating", "bg", UI],
  ["rating", "surface", UI],
  ...["fg", "fg-secondary", "fg-muted", "info"].map((fg): [string, string, number] => [fg, "row-highlight", TEXT]),
];

describe.each([
  ["light", light],
  ["dark", dark],
])("contrast (%s)", (_mode, vars) => {
  it.each(pairs)("%s on %s >= %s:1", (fg, bg, min) => {
    expect(contrast(resolve(vars, fg), resolve(vars, bg))).toBeGreaterThanOrEqual(min);
  });
});

describe("row highlight", () => {
  // Compare "Resaltar diferencias": the tint must be visible on the table surface.
  it.each([
    ["light", light],
    ["dark", dark],
  ])("stands out from the surface (%s)", (_mode, vars) => {
    expect(contrast(resolve(vars, "row-highlight"), resolve(vars, "surface"))).toBeGreaterThanOrEqual(1.1);
  });
});

describe("motion tokens", () => {
  it.each(Object.entries(duration))("--duration-%s matches lib/motion", (name, seconds) => {
    expect(light[`duration-${name}`]).toBe(`${Math.round(seconds * 1000)}ms`);
  });
});

describe("theme overrides", () => {
  it(".dark only overrides semantic/elevation tokens, never primitives", () => {
    const primitive = /^(yellow|red|blue|stone|green|amber|orange|purple)-\d+$/;
    expect(Object.keys(declarations(".dark")).filter((k) => primitive.test(k))).toEqual([]);
  });

  it.each([
    [":root", declarations(":root")],
    [".dark", declarations(".dark")],
  ])("%s semantic tokens point at primitives (var()) or are rgb() overlays", (_selector, vars) => {
    const primitive = /^(yellow|red|blue|stone|green|amber|orange|purple)-\d+$/;
    const nonColour = /^(shadow-color|elevation-|duration-)/;
    const offenders = Object.entries(vars).filter(
      ([key, value]) => !primitive.test(key) && !nonColour.test(key) && !/^var\(--[\w-]+\)$/.test(value) && !/^rgb\(/.test(value)
    );
    expect(offenders).toEqual([]);
  });
});

describe("theme utilities", () => {
  it("every --color-* utility has a consumer in src/ or .storybook/", () => {
    const root = path.resolve(__dirname, "../..");
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|mdx)$/.test(entry.name)) sources.push(fs.readFileSync(full, "utf8"));
      }
    };
    walk(path.join(root, "src"));
    walk(path.join(root, ".storybook"));
    const text = sources.join("\n");
    const names = [...css.matchAll(/--color-([\w-]+)\s*:/g)].map((m) => m[1]);
    const escape = (s: string) => s.replace(/[-]/g, "\\-");
    const unused = names.filter((name) => !new RegExp(`-${escape(name)}(?![\\w-])`).test(text));
    expect(unused).toEqual([]);
  });
});
