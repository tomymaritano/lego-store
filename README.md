# LEGO Store

Tienda online de sets LEGO (proyecto de portfolio): catálogo con búsqueda e
infinite scroll, ficha de producto, carrito, lista de deseos, comparador de
hasta 4 productos y un checkout en pasos (pago simulado). Toda la UI está en
español, tiene modo oscuro y apunta a WCAG 2.1 AA.

Los datos del catálogo son un mock local; el próximo paso del proyecto es un
backend real (ver `docs/superpowers/specs/`). La UI ya está preparada para eso:
todas las lecturas pasan por una sola capa (`src/lib/api`).

<table>
  <tr>
    <td><img src="./screenshots/home-light.png" alt="Inicio, modo claro" width="400"/></td>
    <td><img src="./screenshots/home-dark.png" alt="Inicio, modo oscuro" width="400"/></td>
  </tr>
</table>

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**, TypeScript 5.9
- **Tailwind CSS 4** con tokens de diseño en `@theme` (`src/app/globals.css`)
- Primitivos estilo **shadcn/ui sobre Base UI** (`src/components/ui`)
- **motion** (`motion/react`) para animaciones, con presets en `src/lib/motion.ts`
- **Zustand** (estado del cliente persistido), **TanStack Query** (datos en islas cliente)
- **React Hook Form** + **Zod** (formularios del checkout), **sonner** (toasts)
- **Vitest** (unit + Storybook), **Playwright** (E2E), **Storybook 10** con a11y

Requiere Node `^22.13` o `>=24`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` / `npm start` | Build de producción y servidor |
| `npm run lint` | ESLint (incluye las guardas del sistema de diseño) |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npm test` | Vitest en modo watch (`npx vitest run` para una corrida) |
| `npm run test:coverage` | Cobertura de los tests unitarios |
| `npm run test:e2e` | Playwright (levanta `npm run dev` si no hay servidor) |
| `npm run storybook` | Storybook en http://localhost:6006 |

## Estructura

```
src/
  app/                 Rutas (App Router). Páginas = Server Components.
    api/               Route Handlers para las islas cliente
      products/        GET /api/products (filtros, orden, paginación)
      products/by-ids/ GET /api/products/by-ids?ids=1,2
      search/          GET /api/search?q= (autocompletado)
    checkout/_components/  Pasos del checkout
  components/
    ui/                Primitivos del sistema de diseño (barrel index.ts)
    product/ cart/ search/ layout/ home/ motion/
  data/                Mock del catálogo (solo lo lee src/lib/api)
  hooks/               useProductActions, useProductsByIds, useInfiniteScroll…
  lib/
    api/               Gateway de datos (server-only)
    api-client.ts      Llamadas del navegador a /api/*
    productQuery.ts    ProductQuery <-> URL search params
    motion.ts theme.ts utils.ts validations/
  stores/              Zustand: cart, wishlist, compare, recentlyViewed, theme, reviews, checkout
  types/               Tipos de dominio (única fuente)
__tests__/             Tests unitarios y de componentes (Vitest + Testing Library)
e2e/                   Tests de Playwright
```

## Arquitectura de datos

- **Lecturas**: Server Components llaman a `@/lib/api` (`getPaginatedProducts`,
  `getProductById`, `searchProducts`, `getFilterOptions`, `getCategories`,
  `getRelatedProducts`, `getProductsByIds`…). Son funciones `async` con argumentos y
  resultados serializables; el backend reemplazará su implementación sin cambiar
  las firmas. Importar `@/data` fuera de `src/lib/api` es un error de lint.
- **Islas cliente** (infinite scroll, autocompletado, comparador, favoritos,
  vistos recientemente) usan los Route Handlers de `src/app/api` vía
  `@/lib/api-client` y React Query. El catálogo nunca viaja en el bundle.
- **Búsqueda**: un solo algoritmo (`src/lib/api/search.ts`): todos los términos
  deben aparecer en nombre, tema, categoría o descripción, sin distinguir
  mayúsculas ni acentos.

## Estado del cliente

- Stores de Zustand con **selectores** (`useCartCount`, `useCartSubtotal`,
  `useIsInCart(id)`, `useIsInWishlist(id)`, `useCompareIds`…).
- Persistencia versionada con `migrate` desde formatos anteriores. Comparar y
  vistos recientemente guardan IDs; favoritos, un snapshot mínimo.
- Hidratación: los stores usan `skipHydration` y `<StoreHydrator />` los carga una
  sola vez tras hidratar (y sincroniza pestañas). `useStoresHydrated()` distingue
  "cargando" de "vacío" donde importa.
- Tema: el store es la única fuente de verdad; un script inline en `<head>` aplica
  la clase `dark` antes del primer pintado y `ThemeSync` lo mantiene al día.
- El checkout vive en memoria y nunca guarda el número de tarjeta ni el CVV.

## Sistema de diseño

- **Tokens** en tres niveles (primitivos → semánticos → componente) en
  `globals.css`, expuestos como utilidades: `bg-bg`, `bg-surface`, `text-fg`,
  `text-fg-muted`, `bg-primary`/`text-on-primary`, `text-danger`, `text-info`… El
  contraste AA se verifica en `__tests__/design/tokens.test.ts`.
- **Primitivos** en `src/components/ui`: Button (con `render` para links),
  IconButton, Field, Input, Select, Checkbox, RadioGroup, Slider, Dialog, Sheet,
  Tabs, Card, Badge, Rating, Price, EmptyState, Skeleton, QuantitySelector,
  Toast, Breadcrumbs. Cada uno con stories en claro y oscuro.
- **Guardas de ESLint**: colores crudos de la paleta, `dark:` fuera de `ui/`,
  alias heredados y duraciones numéricas se marcan (errores dentro de `ui/`).
- **Movimiento**: presets en `src/lib/motion.ts` (150–300 ms) y
  `<MotionConfig reducedMotion="user">`; respetan `prefers-reduced-motion`.

## Tests

- `__tests__/lib`: gateway de datos (búsqueda, filtros, orden, paginación,
  casos borde), parser de queries y Route Handlers.
- `__tests__/stores`: stores, selectores, migraciones e hidratación.
- `__tests__/components`: primitivos, ProductCard, useProductActions,
  SearchAutocomplete.
- `__tests__/lint` y `__tests__/design`: guardas de ESLint y contraste de tokens.
- Storybook: cada story se renderiza en Chromium con axe (a11y como error).
- `e2e/`: flujos de inicio, búsqueda, carrito y checkout.

## Licencia

MIT, ver [LICENSE](./LICENSE).
