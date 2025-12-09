# E-commerce Template - Next.js 14

## Product Description

A modern, production-ready e-commerce template built with Next.js 14, TypeScript, and Tailwind CSS. Perfect for launching your online store quickly without starting from scratch.

### Why Choose This Template?

- **Save 100+ hours** of development time
- **Production-ready** - tested and optimized for real-world use
- **SEO Score: 100%** - rank higher on search engines
- **Fully responsive** - works perfectly on all devices
- **Dark mode included** - modern UX out of the box

---

## Features

### Core E-commerce
- Product catalog with categories and filters
- Shopping cart with persistent storage
- Wishlist functionality
- Product comparison (up to 4 items)
- Multi-step checkout flow
- Real-time search with autocomplete

### User Experience
- Dark/Light mode with system detection
- Smooth animations (Framer Motion)
- Loading skeletons for perceived performance
- Toast notifications
- Quick view modals
- Mobile-first responsive design

### Developer Experience
- TypeScript strict mode
- Zustand state management
- React Hook Form + Zod validation
- Storybook component documentation
- Vitest unit tests (48+ tests)
- Playwright E2E tests
- ESLint + Prettier configured

### Performance & SEO
- Lighthouse Performance: 87%
- Lighthouse Accessibility: 79%
- Lighthouse Best Practices: 96%
- Lighthouse SEO: 100%
- Optimized images with Next.js Image
- Dynamic meta tags
- PWA ready

### Internationalization
- Spanish (default)
- English included
- Easy to add more languages

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3.4 |
| State | Zustand |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| Testing | Vitest, Playwright, Storybook |
| Icons | Lucide React |

---

## What's Included

```
lego-store/
├── src/
│   ├── app/              # Next.js pages
│   ├── components/       # Reusable UI components
│   ├── config/           # Site configuration
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities & API layer
│   ├── stores/           # Zustand stores
│   └── types/            # TypeScript definitions
├── public/               # Static assets
├── screenshots/          # Product screenshots
├── .storybook/           # Storybook config
├── tests/                # E2E tests
└── README.md             # Documentation
```

---

## Quick Customization

### 1. Brand Colors
Edit `tailwind.config.ts`:
```typescript
colors: {
  brand: {
    primary: "#your-color",
    secondary: "#your-color",
  }
}
```

### 2. Site Info
Edit `src/config/site.ts`:
```typescript
export const siteConfig = {
  name: "Your Store",
  description: "Your description",
  currency: "USD",
}
```

### 3. Products
Replace `src/data/products.ts` or connect your API.

---

## Support

- Full documentation included
- GitHub issues for bug reports
- Email support for buyers

---

## License

MIT License - Use for personal or commercial projects. No attribution required.

---

## Pricing Tiers

### Standard - $49
- Full source code
- Documentation
- 6 months updates

### Extended - $99
- Everything in Standard
- Priority email support
- 12 months updates
- Future feature access

---

## Tags

next.js, react, typescript, tailwind, e-commerce, template, shopping cart, dark mode, responsive, seo, pwa, storybook, testing
