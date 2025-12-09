# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
