# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The backend (see `docs/superpowers/specs/2026-10-17-backend-completo-design.md`
and the guides in `docs/`): the store runs on PostgreSQL with accounts, server
carts, reviews, orders and payments, and an admin panel. Then the extension
decided on 2026-10-17: Mercado Pago as the main payment provider, coupons, the
full admin (users, categories and themes, uploads, settings, content, inbox,
dashboard, exports, audit log), sitemap and robots, and the documentation.

### Added

- **Database**: PostgreSQL 17 in Docker (`npm run db:up`), Prisma 7 data model
  and migrations with hand-written `CHECK` constraints, an idempotent seed
  (catalogue, sample reviews and orders, coupons, settings, content, admin), a
  separate test database for the Vitest `integration` project.
- **Catalogue from the database** through `src/lib/api`, cached with Next's data
  cache under tags that every write invalidates; one normalised search column.
- **Accounts** (Auth.js v5): email and password, optional Google, JWT sessions
  revocable through `sessionVersion` ("Cerrar sesión en todos los
  dispositivos"), roles USER / ADMIN, `/login`, `/register`, `/account`, 403 page.
- **Rate limiting** on Postgres (login, registration, reviews, checkout, coupons,
  lists, uploads, contact, newsletter), shared by every instance.
- **Cart and wishlist per account**, merged once on login, with optimistic
  updates.
- **Reviews in the database**: one per user and product, verified purchase,
  "útil" votes, cached rating, server-side sort and pages.
- **Orders and payments**: server-priced orders, "Mis pedidos", order emails
  (Resend, or the console without keys), pending-orders cleanup cron.
- **Mercado Pago** as the default provider: Payment Brick (cards in
  installments, cash tickets), Checkout Pro (account money), `PAYMENT_PENDING`
  orders with ticket instructions, signed and idempotent webhooks (`x-signature`,
  the payment read from the API), refunds and cancellations from the admin.
  **Stripe** stays as the alternative behind a `PaymentProvider` interface
  (`PAYMENT_PROVIDER`); every order keeps its provider.
- **Payments mock** for tests and e2e (`PAYMENTS_MOCK=1`, never in a production
  build) and an optional e2e against real Stripe test mode
  (`npm run test:e2e:stripe`).
- **Coupons**: percent or fixed, minimum, dates, total and per-customer limits;
  validated on the server, reserved with the order for 30 minutes, held while a
  payment is pending, released by a database trigger when the order is cancelled.
- **Admin panel**: dashboard with KPIs and charts for a date range; products
  (archive, stock compare-and-set, gallery with alt texts); categories and themes
  in the database with ordering and slug redirects; orders with ship / deliver /
  cancel-and-refund; review moderation; coupons; users with roles and blocking;
  contact inbox; newsletter subscribers; editable info pages (draft / publish);
  store settings (shipping, announcement bar, contact, featured products); CSV
  exports; an audit log of every admin mutation.
- **Image uploads** for the admin, re-encoded with sharp, stored in Vercel Blob
  (`BLOB_READ_WRITE_TOKEN`) or on the local disk.
- **Contact messages and newsletter** stored, with signed unsubscribe links and
  a confirmation email to re-subscribe.
- `/sitemap.xml` and `/robots.txt` from the database.
- **Docs**: `docs/backend.md`, `docs/data-model.md`, `docs/payments.md`,
  `docs/admin.md`, `docs/deploy.md`; architecture, testing and contributing
  guides updated for the backend; a complete `.env.example`.

### Security

- Anti-framing on every route (`X-Frame-Options: DENY`, CSP
  `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`), `nosniff`,
  `Referrer-Policy`, HSTS in production, no `X-Powered-By`.
- An admin's logout always revokes every admin session.
- A production server that trusts no client IP (neither `VERCEL=1` nor
  `TRUSTED_PROXY_HOPS`) or runs the payments mock warns at startup.
- "Realizar pedido" charges only the card shown at "Revisar".
- A production server without Resend logs no email bodies.

### Changed

- Shipping cost and free-shipping threshold come from the store settings;
  `lib/pricing` takes them as an argument.
- Theme links and filters use the theme's slug (`/search?theme=star-wars`);
  names keep working.
- Server messages, setup docs and ESLint guardrail messages in tuteo.
- Playwright: a `store-ops` project, configurable ports, the production build
  starts before `next dev`.

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

Pending work is tracked in the backend spec
(`docs/superpowers/specs/2026-10-17-backend-completo-design.md`) and in the
"Qué no cubre ningún test automático" section of `docs/testing.md`.
