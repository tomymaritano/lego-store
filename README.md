# LEGO Store - E-commerce Portfolio Project

A modern, fully-featured e-commerce web application built with Next.js 14, showcasing best practices in frontend development, design systems, and user experience.

## Features

### Core Functionality

- **Product Catalog** - Browse LEGO sets with filters by category and theme
- **Shopping Cart** - Add/remove items, quantity management, persistent storage
- **Wishlist** - Save favorite products for later
- **Product Comparison** - Compare up to 4 products side by side
- **Search** - Real-time autocomplete with recent searches
- **Checkout Flow** - Multi-step checkout with form validation

### User Experience

- **Dark Mode** - Automatic theme detection with manual toggle
- **Responsive Design** - Mobile-first approach, works on all devices
- **Animations** - Smooth transitions with Framer Motion
- **Accessibility** - ARIA labels, keyboard navigation, skip links
- **Infinite Scroll** - Load more products as you scroll

### Technical Highlights

- **Design Tokens** - CSS custom properties for consistent theming
- **State Management** - Zustand with persistence
- **Type Safety** - Full TypeScript coverage
- **Performance** - Optimized images, lazy loading, code splitting

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
| Testing | Vitest, React Testing Library |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/lego-store.git

# Navigate to project
cd lego-store

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```text
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page
│   ├── cart/              # Cart page
│   ├── checkout/          # Checkout flow
│   ├── item/[productId]/  # Product detail
│   ├── search/            # Search results
│   └── wishlist/          # Wishlist page
├── components/
│   ├── ui/                # Reusable UI components
│   ├── layout/            # Navbar, Footer
│   ├── product/           # Product-related components
│   ├── cart/              # Cart components
│   └── search/            # Search components
├── stores/                 # Zustand stores
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities
├── types/                  # TypeScript types
└── data/                   # Mock product data
```

## Design System

### Color Tokens

The project uses CSS custom properties for theming:

```css
/* Light Mode */
--bg-primary: #ffffff;
--bg-secondary: #faf9f7;
--text-primary: #1d1d1d;
--text-secondary: #57534e;

/* Dark Mode */
--bg-primary: #171412;
--bg-secondary: #1e1b18;
--text-primary: #fafaf9;
--text-secondary: #d6d3d1;

/* Brand Colors */
--lego-yellow: #ffd44a;
--lego-red: #e53935;
--lego-blue: #1e88e5;
```

### Typography

- **Font**: Barlow
- **Weights**: 400, 500, 600, 700, 800, 900

## Key Components

### Button

```tsx
<Button variant="primary" size="lg">
  Add to Cart
</Button>
```

Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`

### Badge

```tsx
<Badge variant="new">New</Badge>
<Badge variant="sale">-20%</Badge>
```

### ProductCard

Displays product with image, price, rating, and quick actions.

### CartDrawer

Slide-out cart with quantity controls and checkout link.

## Performance

- **Lighthouse Score**: 90+ on all metrics
- **Core Web Vitals**: Optimized LCP, FID, CLS
- **Bundle Size**: ~87KB shared JS

## Accessibility

- Skip to content link
- Proper heading hierarchy
- ARIA labels on interactive elements
- Keyboard navigation support
- Reduced motion support
- Focus indicators

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is for portfolio/educational purposes.

## Author

Built with care for demonstrating modern frontend development practices.

---

**Note**: This is a demo project. Product data is mocked and no real transactions occur.
