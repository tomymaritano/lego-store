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
  <tr>
    <td><img src="./screenshots/product-detail.png" alt="Ficha de producto" width="400"/></td>
    <td><img src="./screenshots/cart.png" alt="Carrito, modo oscuro" width="400"/></td>
  </tr>
  <tr>
    <td><img src="./screenshots/checkout.png" alt="Checkout, paso de envío" width="400"/></td>
    <td><img src="./screenshots/mobile.png" alt="Inicio en un teléfono, modo oscuro" width="200"/></td>
  </tr>
</table>

Las capturas se regeneran con `npm run screenshots` contra un build de
producción en marcha (`npm run build && npm start`).

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**, TypeScript 5.9
- **Tailwind CSS 4** con tokens de diseño en `@theme` (`src/app/globals.css`)
- Primitivos estilo **shadcn/ui sobre Base UI** (`src/components/ui`)
- **motion** (`motion/react`, vía `LazyMotion` + `m.*`) para animaciones, con presets en `src/lib/motion.ts`
- **Zustand** (estado del cliente persistido), **TanStack Query** (datos en islas cliente)
- **React Hook Form** + **Zod** (checkout, contacto y reseñas; se cargan solo donde se usan), **sonner** (toasts)
- Barlow servida por `next/font` (self-hosted y precargada)
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
| `npm run test:e2e` | Playwright: proyecto `chromium` contra `npm run dev` y proyecto `prod` contra un build en el puerto 3100 (los levanta si no están) |
| `npm run storybook` / `npm run build-storybook` | Storybook en http://localhost:6006 / build estático |
| `npm run size -- <url>` | JS de primera carga (gzip) por ruta clave contra su presupuesto, sobre un `npm start` en marcha |
| `npm run screenshots` | Regenera las capturas de `screenshots/` (`BASE_URL` para otro origen) |

## Estructura

```
src/
  app/                 Rutas (App Router). Páginas = Server Components.
    (info)/            Ayuda y la tienda: faq, envios, devoluciones, contacto,
                       nosotros, terminos, privacidad (layout con menú lateral)
    api/               Route Handlers para las islas cliente
      products/        GET /api/products (filtros, orden, paginación)
      products/by-ids/ GET /api/products/by-ids?ids=1,2
      products/facets/ GET /api/products/facets (conteos en vivo de los filtros)
      search/          GET /api/search?q= (autocompletado)
    cart/ wishlist/ compare/ search/ category/ item/
    checkout/_components/  Pasos, resumen y confirmación del checkout
  components/
    ui/                Primitivos del sistema de diseño (barrel index.ts)
    layout/            Navbar, Footer, PageHeader, menús y paneles (carga diferida)
    product/           Tarjeta, grilla, catálogo y filtros, ficha, galería, reseñas (reviews/)
    cart/ wishlist/ compare/ search/ home/ info/ forms/ icons/
    motion/            Reveal / Stagger para Server Components
  data/                Mock del catálogo (solo lo lee src/lib/api)
  hooks/               useProductActions, useProductsByIds, useInfiniteScroll…
  lib/
    api/               Gateway de datos (server-only)
    api-client.ts      Llamadas del navegador a /api/*
    productQuery.ts    ProductQuery <-> URL search params
    pricing.ts         Subtotal, envío y totales (carrito y checkout)
    card.ts argentina.ts  Tarjetas, provincias y códigos postales
    flyToCart.ts       Animación "vuela al carrito" (Web Animations API)
    motion.ts motion-features.ts theme.ts metadata.ts utils.ts validations/
  stores/              Zustand: cart, wishlist, compare, recentlyViewed, theme, reviews, checkout, ui
  types/               Tipos de dominio (única fuente)
__tests__/             Tests unitarios y de componentes (Vitest + Testing Library)
e2e/                   Tests de Playwright (e2e/prod: contra el build de producción)
scripts/               Presupuesto de JS y capturas del README
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
- La paleta por defecto de Tailwind está desactivada (`--color-*: initial`):
  solo existen los colores de los tokens.
- **Primitivos** en `src/components/ui`: Button (con `render` para links),
  IconButton, Field, Input, Textarea, Select, Checkbox, RadioGroup, Slider,
  Dialog, Sheet, Tabs, Card, Badge, Rating, RatingInput, Price, EmptyState,
  Skeleton, QuantitySelector, Spinner, Toast, Breadcrumbs, ThemeToggle. Cada
  uno con stories en claro y oscuro.
- **Guardas de ESLint** (errores en todo `src/`): colores crudos de la paleta,
  alias heredados, `dark:` y duraciones numéricas de movimiento. Dentro de
  `ui/` rigen las mismas reglas, salvo que `dark:` está permitido.
- **Movimiento**: presets en `src/lib/motion.ts` (150–300 ms) y
  `<MotionConfig reducedMotion="user">`; respetan `prefers-reduced-motion`. Los
  componentes usan `m.*` dentro de `<LazyMotion>`: las features de motion se
  cargan de forma asíncrona, fuera del JS de primera carga.

## Rendimiento

- Los paneles poco usados (carrito lateral, menú y búsqueda móviles, vista
  rápida, formulario de reseñas) se cargan bajo demanda con `next/dynamic` y se
  precargan al pasar el puntero o enfocar su botón.
- `npm run size` mide el JS de primera carga por ruta (gzip, sin los polyfills
  `noModule`) contra un presupuesto por ruta; CI lo corre en cada PR.
- Lighthouse CI (`lighthouserc.json`) audita `/`, `/item/1`, `/category/helmet`,
  `/cart` y `/checkout`. El objetivo de SEO 100 excluye `/cart` y `/checkout`:
  son `noindex` a propósito (lo correcto en páginas transaccionales), así que no
  se afirma SEO sobre ellas.

## Tests

- `__tests__/lib`: gateway de datos (búsqueda, filtros, orden, paginación,
  casos borde), parser de queries y Route Handlers.
- `__tests__/stores`: stores, selectores, migraciones e hidratación.
- `__tests__/components`: primitivos (`ui/`), carrito lateral, carrito /
  favoritos / comparador, catálogo y filtros, checkout, formularios, galería,
  ficha de producto, reseñas, autocompletado, useProductActions,
  useProductsByIds y suscripciones a los stores.
- `__tests__/config`: cada link de navegación resuelve a una página.
- `__tests__/lint` y `__tests__/design`: guardas de ESLint y contraste de tokens.
- Storybook: cada story se renderiza en Chromium con axe (a11y como error).
- `e2e/`: inicio, catálogo (filtros en la URL, orden, precio), búsqueda, ficha,
  carrito, listas (favoritos y comparador), checkout (con axe), shell (navbar,
  footer, páginas de información, 404), estado persistido y el proyecto `prod`
  (navegación y transiciones sobre el build de producción).

CI (`.github/workflows/ci.yml`): lint, tipos, tests con cobertura, build de
Storybook, build, E2E, auditoría de dependencias de producción, presupuesto de
JS y Lighthouse.

## Licencia

MIT, ver [LICENSE](./LICENSE).
