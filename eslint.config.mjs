import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";

/*
 * Design-system guardrails (see docs/superpowers/specs/2026-10-17-ui-overhaul-design.md).
 * They match class names inside any string or template literal.
 * Covered by __tests__/lint/guardrails.test.ts: add a case there when you touch a pattern.
 */
const PALETTE =
  "(gray|slate|zinc|neutral|stone|red|blue|green|yellow|amber|orange|purple|pink|sky|cyan|lime|emerald|teal|indigo|violet|fuchsia|rose)-\\d\\d\\d?\\b";
const WHITE_BLACK =
  "\\b(bg|text|border|ring|ring-offset|from|via|to|fill|stroke|outline|divide|decoration|accent|caret|shadow|inset-shadow|inset-ring|placeholder)-(white|black)\\b";
// Arbitrary colours: bg-[#f00], bg-[rgb(255_0_0)], text-[hsl(...)], bg-[oklch(...)], text-[color:#f00].
// Literal "[" and "(" are written as [[] and [(] to keep the esquery regexes simple.
const ARBITRARY_COLOR = "-[[](color:)?(#|(rgb|hsl)a?[(]|okl(ch|ab)[(])";
// `dark:` at the start of a class or after another variant (md:dark:, hover:dark:).
const DARK_VARIANT = "(^|[\\s\"'`:])dark:";
// Transitional @theme aliases in globals.css: they expose primitives / legacy
// names as utilities, so every use is flagged until pages move to semantic tokens.
const LEGACY_ALIAS =
  "-(lego-[a-z]+(-dark)?|brand-\\d\\d\\d?|background(-(primary|secondary|tertiary))?|foreground(-(primary|secondary|muted))?|status-(success|error|warning|info)|border-subtle)\\b";
// Hex / functional colours in JSX style objects: style={{ color: "#f00" }}.
const STYLE_COLOR = "^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?[(]|okl(ch|ab)[(])";
// Motion props that take timing values.
const MOTION_PROPS = "^(transition|animate|initial|exit|whileHover|whileTap|whileInView|whileFocus|variants)$";

const rawColorMessage =
  "Usá tokens semánticos (bg-surface, text-fg-muted, bg-primary, text-danger…) en vez de colores crudos de la paleta.";
const aliasMessage =
  "Alias transicional (lego-*, brand-*, background-*, foreground-*, status-*, border-subtle): usá el token semántico (bg-bg, text-fg, bg-primary, text-danger…).";
const darkMessage =
  "No uses `dark:` fuera de src/components/ui: los tokens semánticos ya cambian con el tema.";
const motionMessage =
  "Usá los presets de @/lib/motion (transitions.fast/base/slow, fadeInUp, staggerItem…) en vez de duraciones numéricas sueltas.";

const literal = (pattern, message) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
];

const rawColorSelectors = [
  ...literal(PALETTE, rawColorMessage),
  ...literal(WHITE_BLACK, rawColorMessage),
  ...literal(ARBITRARY_COLOR, rawColorMessage),
  {
    selector: `JSXAttribute[name.name='style'] Property > Literal[value=/${STYLE_COLOR}/]`,
    message: rawColorMessage,
  },
];
const aliasSelectors = literal(LEGACY_ALIAS, aliasMessage);
const darkSelectors = literal(DARK_VARIANT, darkMessage);
const motionSelectors = [
  {
    selector: `JSXAttribute[name.name=/${MOTION_PROPS}/] Property[key.name='duration'][value.type='Literal']`,
    message: motionMessage,
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],

  // App code: raw palette, legacy aliases + ad-hoc dark: are warnings until pages migrate
  // to the semantic tokens (next stage of the overhaul).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": ["warn", ...rawColorSelectors, ...aliasSelectors, ...darkSelectors, ...motionSelectors],
    },
  },
  // Primitives must stay clean: raw palette, legacy aliases and numeric motion
  // durations are errors. `dark:` is allowed here.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...rawColorSelectors, ...aliasSelectors, ...motionSelectors],
    },
  },
  // Data access goes through src/lib/api.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/api/**", "src/data/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/data", "@/data/*", "**/data/products"],
              message: "Leé los datos vía @/lib/api, no importes @/data/* directamente.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "storybook-static/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
