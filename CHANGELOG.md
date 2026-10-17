# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-17

UI overhaul (see `docs/superpowers/specs/2026-10-17-ui-overhaul-design.md`).

### Changed

- **Framework**: Next.js 16 (App Router, Turbopack, `proxy.ts`) and React 19;
  pages are Server Components with small client islands. Node `^22.13 || >=24`.
- **Styling**: Tailwind CSS 4 with three-tier design tokens in `@theme`
  (primitives, semantic, component), AA contrast checked by tests, dark mode on
  semantic tokens only. Tailwind's default palette is disabled.
- **Components**: shadcn-style primitives on Base UI (`src/components/ui`) with
  Storybook 10 stories, a11y checked as errors.
- **Data**: every read goes through `src/lib/api` (async, serializable; ready
  for the backend); client islands use Route Handlers.
- **Motion**: `motion` (`motion/react`) instead of framer-motion, presets in
  `src/lib/motion.ts` (150-300 ms), reduced motion respected, LazyMotion.
- **Lint**: ESLint 9 flat config; design-system guardrails (raw palette,
  legacy aliases, `dark:`, numeric timing) are errors.
- **Performance**: Barlow via `next/font`, on-demand panels, review form and
  form validation (zod), first-load JS budgets per route (`npm run size`).
- **Pages rebuilt**: wishlist and compare (existing pages, redesigned on the
  new primitives), checkout as a three-step flow, and a designed 404 instead
  of the old not-found page.

### Added

- Catalogue filters in the URL with live facet counts, "highlight
  differences" on the compare page, undo toasts (cart, wishlist, compare),
  Argentine address and card validation in checkout, info pages (FAQ, envíos,
  devoluciones, contacto, nosotros, términos, privacidad).
- Tests: Vitest (unit + Storybook projects), Playwright E2E including a
  production project; CI runs lint, types, unit, Storybook build, build, E2E,
  audit, JS budget and Lighthouse.

### Removed

- The unused i18n system (the UI is Spanish only).
- Unused or duplicated dependencies (react-hot-toast, keen-slider,
  framer-motion, among others) and dead components.

### Accessibility

- WCAG 2.1 AA target: labelled controls, landmarks and heading order, visible
  focus, keyboard support in every widget. Lighthouse accessibility 100 and
  best practices 100 on the key routes (mobile and desktop).

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

### Planned Features
- [ ] User authentication (NextAuth.js)
- [ ] Order history
- [ ] Product reviews
- [ ] Admin dashboard
- [ ] Email notifications
- [ ] Payment gateway integration (Stripe/MercadoPago)

### Improvements
- [ ] Server-side cart sync
- [ ] Advanced analytics
- [ ] A/B testing support
- [ ] Performance monitoring
