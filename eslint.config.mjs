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
// Named arbitrary colours: bg-[red], text-[white], border-[color:navy]. CSS keywords stay allowed.
const NAMED_ARBITRARY_COLOR =
  "\\b(bg|text|border(-[trblxy])?|ring|ring-offset|from|via|to|fill|stroke|outline|divide|decoration|accent|caret|shadow|placeholder)-[[](color:)?(?!(inherit|transparent|current[cC]olor|initial|unset|none|auto)\\])[a-zA-Z]+\\]";
// Hex / functional colours anywhere in a JSX style value: style={{ border: "1px solid #f00" }}.
const STYLE_COLOR = "(#[0-9a-fA-F]{3,8}\\b|(rgb|hsl)a?[(]|okl(ch|ab)[(])";
// SVG presentation attributes: <path fill="#f00" />, <stop stopColor="rgb(...)" />.
const SVG_COLOR_ATTRS = "^(fill|stroke|stopColor|floodColor|lightingColor|color)$";
const SVG_COLOR = "^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?[(]|okl(ch|ab)[(])";
// Tailwind numeric timing / stock easing: duration-300, ease-in-out. Use duration-fast/base/slow + ease-standard/emphasized/exit.
const TW_TIMING = "(^|[\\s\"'`:])(duration-\\d+|ease-(in|out|in-out|linear))(?![\\w-])";
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
const twTimingMessage =
  "Usá los tokens de movimiento (duration-fast/base/slow, ease-standard/emphasized/exit) en vez de duration-300 / ease-in-out.";
const transitionScaleMessage =
  "En Tailwind v4 scale-*/rotate-*/translate-* usan sus propias propiedades CSS: listá scale/rotate/translate en transition-[...], no `transform`.";

const literal = (pattern, message) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
];

const rawColorSelectors = [
  ...literal(PALETTE, rawColorMessage),
  ...literal(WHITE_BLACK, rawColorMessage),
  ...literal(ARBITRARY_COLOR, rawColorMessage),
  ...literal(NAMED_ARBITRARY_COLOR, rawColorMessage),
  { selector: `JSXAttribute[name.name='style'] Property Literal[value=/${STYLE_COLOR}/]`, message: rawColorMessage },
  { selector: `JSXAttribute[name.name='style'] TemplateElement[value.raw=/${STYLE_COLOR}/]`, message: rawColorMessage },
  { selector: `JSXAttribute[name.name=/${SVG_COLOR_ATTRS}/] Literal[value=/${SVG_COLOR}/]`, message: rawColorMessage },
];
const aliasSelectors = literal(LEGACY_ALIAS, aliasMessage);
const darkSelectors = literal(DARK_VARIANT, darkMessage);
const DURATION = "Property[key.name='duration'][value.type='Literal']";
const motionSelectors = [
  // Inline in a motion prop: transition={{ duration: 0.6 }}.
  { selector: `JSXAttribute[name.name=/${MOTION_PROPS}/] ${DURATION}`, message: motionMessage },
  // Hoisted: const v = { visible: { transition: { duration: 0.6 } } }.
  { selector: `Property[key.name='transition'] ${DURATION}`, message: motionMessage },
  // Hoisted by name or type: const transition = { duration: 0.6 }, const v: Variants = {...}.
  { selector: `VariableDeclarator[id.name=/(transition|variants)$/i] ${DURATION}`, message: motionMessage },
  {
    selector: `VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name=/^(Variants|Transition)$/] ${DURATION}`,
    message: motionMessage,
  },
  ...literal(TW_TIMING, twTimingMessage),
  ...literal("transition-[[][a-z,-]*\\btransform\\b", transitionScaleMessage),
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
  // Data access goes through src/lib/api (server-only): the catalogue must never
  // be imported by pages or client components directly.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/api/**", "src/data/**"],
    rules: {
      "no-restricted-imports": [
        "error",
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
