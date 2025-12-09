# E-commerce Template - Next.js 14

A modern, production-ready e-commerce template built with Next.js 14, TypeScript, and Tailwind CSS. Perfect for building online stores, marketplaces, or showcasing products.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Core Functionality

- **Product Catalog** - Browse products with filters by category and theme
- **Shopping Cart** - Add/remove items, quantity management, persistent storage
- **Wishlist** - Save favorite products for later
- **Product Comparison** - Compare up to 4 products side by side
- **Search** - Real-time autocomplete with debouncing and recent searches
- **Checkout Flow** - Multi-step checkout with form validation

### User Experience

- **Dark Mode** - Automatic theme detection with manual toggle
- **Responsive Design** - Mobile-first approach, works on all devices
- **Animations** - Smooth transitions with Framer Motion
- **Accessibility** - ARIA labels, keyboard navigation, skip links
- **Infinite Scroll** - Load more products as you scroll
- **SEO Optimized** - Meta tags, Open Graph, structured data ready

### Technical Highlights

- **Design Tokens** - CSS custom properties for consistent theming
- **State Management** - Zustand with localStorage persistence
- **Type Safety** - Full TypeScript coverage
- **API Layer** - Abstracted data layer, easy to connect to any backend
- **Performance** - Optimized images, lazy loading, code splitting

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Customization

### 1. Site Configuration

Edit `src/config/site.ts` to customize your store:

```typescript
export const siteConfig = {
  name: "Your Store Name",
  description: "Your store description",
  url: "https://yourstore.com",
  locale: "en-US",
  currency: "USD",
  contact: {
    email: "hello@yourstore.com",
    phone: "+1 234 567 890",
  },
  social: {
    instagram: "https://instagram.com/yourstore",
    // ...
  },
};
```

### 2. Theme Colors

Update brand colors in `tailwind.config.ts`:

```typescript
colors: {
  brand: {
    yellow: "#ffd44a",
    red: "#e53935",
    blue: "#1e88e5",
  },
}
```

### 3. Products Data

Replace mock data in `src/data/products.ts` or connect to your API by updating `src/lib/api/products.ts`.

### 4. Connect to Backend

The API layer (`src/lib/api/`) is designed for easy backend integration:

```typescript
// src/lib/api/products.ts
export async function getProducts(): Promise<Product[]> {
  // Replace with your API call
  const response = await fetch(`${API_BASE_URL}/products`);
  return response.json();
}
```

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS, CSS Variables |
| State | Zustand |
| Animations | Framer Motion |
| Icons | Lucide React |
| Data Fetching | TanStack Query |

## Project Structure

```text
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page
│   ├── cart/              # Cart page
│   ├── checkout/          # Checkout flow
│   ├── compare/           # Product comparison
│   ├── item/[productId]/  # Product detail
│   ├── search/            # Search results
│   └── wishlist/          # Wishlist page
├── components/
│   ├── ui/                # Reusable UI components (Button, Input, etc.)
│   ├── layout/            # Navbar, Footer, PageTransition
│   ├── product/           # Product-related components
│   ├── cart/              # Cart components
│   └── search/            # Search components
├── config/                 # Site configuration
├── hooks/                  # Custom React hooks
├── lib/
│   ├── api/               # API service layer
│   └── utils.ts           # Utilities
├── stores/                 # Zustand stores
├── types/                  # TypeScript types
└── data/                   # Mock product data
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |

## Design System

### Color Tokens

CSS custom properties for easy theming:

```css
/* Light Mode */
--bg-primary: #ffffff;
--bg-secondary: #faf9f7;
--text-primary: #1d1d1d;

/* Dark Mode (automatic) */
--bg-primary: #171412;
--bg-secondary: #1e1b18;
--text-primary: #fafaf9;
```

### Components

- **Button** - Primary, Secondary, Outline, Ghost, Danger variants
- **Input** - Text, Search, with validation states
- **Badge** - New, Sale, Status indicators
- **Card** - Product cards with hover effects
- **Drawer** - Cart sidebar, mobile menu
- **Toast** - Notifications system
- **Skeleton** - Loading states

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Deploy with one click

### Other Platforms

Build the production bundle:

```bash
npm run build
```

The output will be in `.next/` folder.

## Environment Variables

Create a `.env.local` file:

```env
# API Configuration (optional)
NEXT_PUBLIC_API_URL=https://api.yourstore.com

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - feel free to use for personal or commercial projects.

## Support

For questions or issues, please open a GitHub issue or contact support.

---

Built with Next.js, TypeScript, and Tailwind CSS.
