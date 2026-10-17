import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";

/*
 * Design-system guardrails (see docs/superpowers/specs/2026-10-17-ui-overhaul-design.md).
 * They match class names inside any string or template literal.
 */
const PALETTE =
  "(gray|slate|zinc|neutral|stone|red|blue|green|yellow|amber|orange|purple|pink|sky|cyan|lime|emerald|teal|indigo|violet|fuchsia|rose)-\\d\\d\\d?\\b";
const WHITE_BLACK = "\\b(bg|text|border|ring|from|via|to|fill|stroke|outline|divide|decoration|accent|caret)-(white|black)\\b";
const ARBITRARY_HEX = "-\\[#[0-9a-fA-F]";
const DARK_VARIANT = "(^|[\\s\"'`])dark:";

const rawColorMessage =
  "Usá tokens semánticos (bg-surface, text-fg-muted, bg-primary, text-danger…) en vez de colores crudos de la paleta.";
const darkMessage =
  "No uses `dark:` fuera de src/components/ui: los tokens semánticos ya cambian con el tema.";

const literal = (pattern, message) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
];

const rawColorSelectors = [
  ...literal(PALETTE, rawColorMessage),
  ...literal(WHITE_BLACK, rawColorMessage),
  ...literal(ARBITRARY_HEX, rawColorMessage),
];
const darkSelectors = literal(DARK_VARIANT, darkMessage);

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],

  // App code: raw palette + ad-hoc dark: are warnings until pages migrate
  // to the semantic tokens (next stage of the overhaul).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": ["warn", ...rawColorSelectors, ...darkSelectors],
    },
  },
  // Primitives must stay clean: raw palette is an error. `dark:` is allowed here.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...rawColorSelectors],
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
