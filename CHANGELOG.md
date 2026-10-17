# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-17

UI overhaul (see `docs/superpowers/specs/2026-10-17-ui-overhaul-design.md`).

### Changed

- **Framework**: Next.js 16 (App Router, Turbopack, `proxy.ts`) and React 19
  (from Next.js 14 and React 18); pages are Server Components with small client
  islands. Node `^22.13 || >=24`.
- **Styling**: Tailwind CSS 4 (from 3) with three-tier design tokens in
  `globals.css` (primitives, semantic, component), AA contrast checked by tests,
  dark mode on semantic tokens only, a type scale (`text-caption` …
  `text-display`). Tailwind's default palette is disabled.
- **Components**: shadcn-style primitives on Base UI (`src/components/ui`),
  each with Storybook 10 stories in light and dark; a11y violations fail the
  story tests.
- **Data**: every read goes through `src/lib/api` (server-only, async,
  serializable; ready for the backend); client islands use Route Handlers
  (`/api/products`, `/api/products/by-ids`, `/api/products/facets`,
  `/api/search`). One search algorithm for the search page and autocomplete.
- **State**: persisted stores with versioned migrations, compare and recently
  viewed keep only ids, one `StoreHydrator` after hydration, theme applied
  before first paint.
- **Motion**: `motion` (`motion/react`) instead of framer-motion, presets in
  `src/lib/motion.ts` (150-300 ms), reduced motion respected, LazyMotion.
- **Lint**: ESLint 9 flat config (from ESLint 8 and `next lint`);
  design-system guardrails (raw palette, legacy aliases, `dark:`, numeric
  timing, stock font sizes, `@/data` imports outside `src/lib/api`) are errors.
- **Performance**: Barlow via `next/font`, prerendered home, product and
  category pages, on-demand panels, Sonner and reviews loaded after hydration,
  zod loaded only where a form validates, AVIF images.
- **Rebuilt on the new primitives** (these pages and features existed before):
  wishlist and compare pages, cart page and cart drawer, product page with
  gallery and reviews, recently viewed, quick view, search autocomplete,
  checkout (now a three-step flow) and the 404 page.
- **Tests and CI** (Vitest, Storybook tests, Playwright and CI already
  existed): Vitest split into `unit` and `storybook` projects, a production
  Playwright project (`prod`), axe checks on every page in light and dark,
  token-contrast and guardrail tests. CI now also builds Storybook and runs
  E2E; the bundle-analyzer step is replaced by first-load JS budgets per route
  (`npm run size`), and the audit gates on production dependencies.

### Added

- Catalogue filters and sort in the URL, with live facet counts and active
  filter chips.
- "Resaltar diferencias" on the compare page.
- Undo toasts for removals (cart, wishlist, compare).
- Argentine address and card validation in checkout.
- Info pages: FAQ, envíos, devoluciones, contacto, nosotros, términos,
  privacidad.
- Product JSON-LD, FAQ JSON-LD, canonical URLs and a generated Open Graph image.
- Real 404 status for unknown products and categories (`src/proxy.ts`).

### Removed

- The unused i18n system (the UI is Spanish only).
- Template-for-sale leftovers (`MARKETPLACE.md`, `dist/*.zip`,
  `scripts/package-for-sale.sh`).
- Unused or duplicated dependencies (react-hot-toast, keen-slider,
  framer-motion, among others), `tailwind.config.ts`, `.eslintrc.json`, the
  per-route layouts and dead components.

### Accessibility

- WCAG 2.1 AA target: labelled controls, landmarks and heading order, visible
  focus, keyboard support in every widget. Lighthouse CI gates accessibility
  at 0.95 on the audited routes; the last local run scored 100 for
  accessibility and best practices.

---

## [1.1.0] - 2024-12-09

### Added

- **Storybook**
  - Component stories for Button, Badge, Input, Skeleton, ProductCard
  - Global styles integration
  - Accessibility addon enabled
  - Multiple background options (light, dark, lego-yellow)

- **Lighthouse Audit**
  - Performance: 87%
  - Accessibility: 79%
  - Best Practices: 96%
  - SEO: 100%

### Fixed

- Fixed Recently Viewed tracking with useRef to prevent duplicates
- Fixed ProductReviews infinite re-render loop with useMemo
- Fixed product page params handling for Next.js 14 compatibility

---

## [1.0.0] - 2024-12-09

### Added

- **Core Features**
  - Product catalog with 22+ LEGO sets across multiple themes
  - Shopping cart with persistent state (Zustand + localStorage)
  - Wishlist functionality
  - Product comparison (up to 4 products)
  - Advanced search with autocomplete and debounce
  - Product filtering by theme, category, price, and more

- **UI/UX**
  - Dark mode support with system preference detection
  - Responsive design (mobile-first)
  - Smooth page transitions with Framer Motion
  - Loading skeletons for better perceived performance
  - Toast notifications for user feedback
  - Quick view modal for products

- **Pages**
  - Home page with featured products and categories
  - Product detail page with image gallery
  - Search results page with filters
  - Cart page with quantity management
  - Checkout flow (shipping + payment forms)
  - Wishlist page
  - Compare page
  - 404 and 500 error pages

- **Technical**
  - Next.js 14 App Router
  - TypeScript strict mode
  - Tailwind CSS with design tokens
  - Zustand for state management
  - React Hook Form + Zod validation
  - SEO optimized with dynamic meta tags
  - PWA ready with manifest.json

- **Testing**
  - Vitest for unit tests
  - Playwright for E2E tests
  - Storybook for component documentation

- **i18n**
  - Spanish (default) and English translations
  - Easy to extend to other languages

### Configuration

- Centralized site config in `src/config/site.ts`
- Design tokens via CSS variables
- Easy theming through Tailwind config

## [0.1.0] - Initial Release

- Basic project setup with Next.js 14
- Initial component library
- Product data structure

---

## Roadmap

Next: a real backend (database catalogue, users, server-side cart, orders,
payments, real reviews, admin). See
`docs/superpowers/specs/2026-10-17-backend-completo-design.md`.
