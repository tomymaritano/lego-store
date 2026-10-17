# LEGO Store

Tienda online de sets LEGO (proyecto de portfolio): catálogo con búsqueda e
infinite scroll, ficha de producto, carrito, lista de deseos, comparador de
hasta 4 productos y un checkout en pasos (pago simulado). Toda la UI está en
español, tiene modo oscuro y apunta a WCAG 2.1 AA.

El catálogo vive en PostgreSQL (Prisma) y todas las lecturas pasan por una sola
capa (`src/lib/api`). El resto del backend (usuarios, carrito y favoritos en el
servidor, reseñas, pedidos con Stripe, emails, admin) se construye por etapas
según `docs/superpowers/specs/2026-10-17-backend-completo-design.md`. La app
necesita Postgres para correr: ver [Backend local setup](#backend-local-setup).

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
- **PostgreSQL 17** + **Prisma 7** (cliente `prisma-client` generado en `src/generated/prisma`, driver adapter `@prisma/adapter-pg`)
- **Zustand** (estado del cliente persistido), **TanStack Query** (datos en islas cliente)
- **React Hook Form** + **Zod** (checkout, contacto y reseñas; se cargan solo donde se usan), **sonner** (toasts)
- Barlow servida por `next/font` (self-hosted y precargada)
- **Vitest** (unit + Storybook), **Playwright** (E2E), **Storybook 10** con a11y

Requiere Node `^22.13` o `>=24`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 (necesita la base, ver abajo) |
| `npm run build` / `npm start` | Build de producción y servidor (el build lee la base: prerenderiza el catálogo) |
| `npm run db:up` / `npm run db:down` | Levanta / detiene Postgres en Docker (bases `lego_store` y `lego_store_test`) |
| `npm run db:migrate` | `prisma migrate dev`: aplica migraciones pendientes en dev (y crea una nueva si cambiaste el schema) |
| `npm run db:deploy` | `prisma migrate deploy`: solo aplica migraciones (CI, producción) |
| `npm run db:seed` | Carga categorías, productos, reseñas de ejemplo y el admin (idempotente) |
| `npm run db:reset` | Borra la base de dev, reaplica las migraciones y vuelve a sembrar (pide confirmación) |
| `npm run db:studio` | Prisma Studio para mirar y editar la base |
| `npm run db:generate` | Regenera el cliente de Prisma (también corre en `postinstall`) |
| `npm run lint` | ESLint (incluye las guardas del sistema de diseño) |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npm test` | Vitest en modo watch (`npx vitest run` para una corrida: unit + integración + Storybook) |
| `npm run test:unit` / `npm run test:integration` | Solo los tests unitarios (sin base) / solo los de integración (base de test) |
| `npm run test:db:setup` | Reconstruye la base de test desde cero (si quedó desfasada de las migraciones) |
| `npm run test:coverage` | Cobertura de los tests unitarios |
| `npm run test:e2e` | Playwright: proyecto `chromium` contra `npm run dev` y proyecto `prod` contra un build en el puerto 3100 (los levanta si no están) |
| `npm run storybook` / `npm run build-storybook` | Storybook en http://localhost:6006 / build estático |
| `npm run size -- <url>` | JS de primera carga (gzip) por ruta clave contra su presupuesto, sobre un `npm start` en marcha |
| `npm run screenshots` | Regenera las capturas de `screenshots/` (`BASE_URL` para otro origen) |

## Estructura

```
prisma/
  schema.prisma        Modelo de datos (usuarios y tablas de Auth.js, catálogo,
                       carrito, favoritos, reseñas, pedidos, eventos de Stripe)
  migrations/          Migraciones SQL (las restricciones CHECK van escritas a mano)
  seed.ts seed/        Seed idempotente (catálogo de src/data, reseñas y pedidos de ejemplo, admin)
prisma.config.ts       Config del CLI de Prisma (URL de la base, seed)
docker-compose.yml     Postgres local (dev + test)
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
  data/                Fuente del seed (la app no lo lee: ESLint lo impide)
  generated/prisma/    Cliente de Prisma generado (gitignored)
  hooks/               useProductActions, useProductsByIds, useInfiniteScroll…
  lib/
    api/               Gateway de datos (server-only): consultas Prisma + caché de Next
    db/                Cliente de Prisma (instancia única en el servidor)
    auth/password.ts   Hash de contraseñas (bcrypt)
    api-client.ts      Llamadas del navegador a /api/*
    productQuery.ts    ProductQuery <-> URL search params
    pricing.ts         Subtotal, envío y totales (carrito y checkout)
    card.ts argentina.ts  Tarjetas, provincias y códigos postales
    flyToCart.ts       Animación "vuela al carrito" (Web Animations API)
    motion.ts motion-features.ts theme.ts metadata.ts utils.ts validations/
  stores/              Zustand: cart, wishlist, compare, recentlyViewed, theme, reviews, checkout, ui
  types/               Tipos de dominio (única fuente)
__tests__/             Tests unitarios y de componentes (Vitest + Testing Library)
  integration/         Tests contra la base de test (lib/api, Route Handlers, proxy, seed, restricciones)
e2e/                   Tests de Playwright (e2e/prod: contra el build de producción)
scripts/               Presupuesto de JS y capturas del README
```

## Arquitectura de datos

- **Lecturas**: Server Components llaman a `@/lib/api` (`getPaginatedProducts`,
  `getProductById`, `searchProducts`, `getFilterOptions`, `getCategories`,
  `getRelatedProducts`, `getProductsByIds`…). Son funciones `async` con argumentos y
  resultados serializables, implementadas con Prisma (`src/lib/api/catalog.ts`):
  filtros, búsqueda, orden y paginación corren en Postgres. Importar `@/data` desde
  `src/` es un error de lint: es solo la fuente del seed.
- **Caché**: cada lectura del catálogo pasa por el data cache de Next
  (`unstable_cache`, el modelo previo a Cache Components, que la app no activa) con
  tags: `products` (todo el catálogo), `product:<id>` y `categories`. Las páginas
  del catálogo se prerenderizan en el build y se regeneran en la próxima visita
  después de que una escritura llama a `invalidateCatalog()` (`src/lib/api/cache.ts`,
  vencimiento inmediato). Hay además una revalidación por tiempo de 1 h como red de
  seguridad. Lo que depende del usuario (carrito, pedidos, cuenta) no pasa por esta
  caché.
- **Islas cliente** (infinite scroll, autocompletado, comparador, favoritos,
  vistos recientemente) usan los Route Handlers de `src/app/api` vía
  `@/lib/api-client` y React Query. El catálogo nunca viaja en el bundle.
- **Búsqueda**: un solo algoritmo (`src/lib/api/search.ts`): todos los términos
  deben aparecer en nombre, tema, categoría o descripción, sin distinguir
  mayúsculas ni acentos. Cada producto guarda ese texto ya normalizado
  (`Product.searchText`, sin acentos y en minúsculas) y la búsqueda es un `LIKE`
  por término, sin extensiones de Postgres; el ranking (términos en el nombre)
  se aplica sobre esas filas. Toda escritura de un producto recalcula esas
  columnas con `productSearchColumns()`.
- **Rating**: `Product.rating` y `Product.reviewCount` son columnas cacheadas del
  promedio y la cantidad de reseñas (`refreshProductRatings()`); un producto sin
  reseñas tiene rating 0 y va al final de "Destacados" y "Mejor calificados".

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

## Backend local setup

Requisitos: Node `^22.13` o `>=24` y Docker (Docker Desktop en Windows/macOS).

```bash
npm install                 # también genera el cliente de Prisma (postinstall)
cp .env.example .env.local  # los valores por defecto ya apuntan al Postgres de Docker
npm run db:up               # Postgres 17 en localhost:5433, bases lego_store y lego_store_test
npm run db:migrate          # aplica las migraciones a lego_store
npm run db:seed             # catálogo, reseñas de ejemplo y el usuario admin
npm run dev
```

- **Puerto**: Docker publica Postgres en el **5433** para no chocar con un Postgres
  instalado en el 5432. Para otro puerto: `POSTGRES_PORT=5434 npm run db:up` y
  ajustá las URLs de `.env.local`.
- **Admin de desarrollo**: si `ADMIN_EMAIL` y `ADMIN_PASSWORD` no están definidas (o
  están vacías, como en `.env.example`), el seed crea `admin@lego-store.local` /
  `admin-dev-1234`, pero solo si `DATABASE_URL` apunta a `localhost` (o con
  `SEED_DEV_ADMIN=1`); contra cualquier otra base no crea admin. Si definís solo una
  de las dos, el seed falla: van juntas. Volver a sembrar actualiza la contraseña si
  cambió.
- **El seed es idempotente**: se puede correr las veces que haga falta. Vuelve las
  categorías y los productos del seed a sus valores (stock incluido), crea o
  actualiza los usuarios de ejemplo (sin contraseña: no se puede entrar con ellos),
  sus reseñas, votos "útil" y pedidos entregados (los que hacen "compra
  verificada"), y recalcula los ratings. Lo que crearon personas (registros,
  reseñas, pedidos) no se toca.
- **Tests de integración**: `npx vitest run` incluye el proyecto `integration`, que
  usa `DATABASE_URL_TEST` (su nombre tiene que contener "test"): aplica las
  migraciones pendientes al empezar y cada archivo vacía y vuelve a sembrar las
  tablas que usa. Los archivos corren uno tras otro. Sin la base levantada, la
  corrida falla con un mensaje que lo explica.
- **El build necesita la base**: `next build` prerenderiza inicio, categorías y
  fichas leyendo Postgres. En CI hay un servicio Postgres que se migra y siembra
  antes del build, los tests y los E2E.
- **Cambiar el modelo**: editá `prisma/schema.prisma` y corré
  `npm run db:migrate -- --name <cambio>` y `npm run db:generate`. Las restricciones
  CHECK (stock ≥ 0, cantidades > 0, rating 1..5, totales que cierran…) están escritas
  a mano en la primera migración: si una migración nueva recrea una tabla, copiá
  las suyas.
- **Producción** (Vercel + Neon u otro Postgres): `DATABASE_URL` en las variables
  del proyecto y `npm run db:deploy` + `npm run db:seed` contra esa base antes del
  primer deploy.

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
  alias heredados, `dark:`, duraciones numéricas de movimiento y tamaños de
  texto de Tailwind (`text-sm`, `text-2xl`…: se usa la escala `text-caption`,
  `text-label`, `text-body`, `text-title`, `text-heading`, `text-headline`,
  `text-display`). Dentro de `ui/` rigen las mismas reglas, salvo que `dark:`
  y los tamaños compactos de los primitivos están permitidos.
- **Movimiento**: presets en `src/lib/motion.ts` (150–300 ms) y
  `<MotionConfig reducedMotion="user">`; respetan `prefers-reduced-motion`. Los
  componentes usan `m.*` dentro de `<LazyMotion>` (el bundle de features se
  pide aparte, aunque Turbopack hoy lo deja en el chunk compartido de motion:
  unos 45 kB gzip en la primera carga).

## Rendimiento

- Inicio, fichas y categorías se prerenderizan (desde la base, en el build) sin `loading.tsx`: el HTML
  estático trae el contenido en orden y el texto del hero (el LCP) se pinta en
  el primer frame. Los filtros de una categoría viven en la URL y se aplican en
  el cliente, así que la ruta sigue siendo estática.
- Los paneles poco usados (carrito lateral, menú y búsqueda móviles, vista
  rápida, formulario de reseñas) se cargan bajo demanda con `next/dynamic` y se
  precargan al pasar el puntero o enfocar su botón. Sonner (toasts) y las
  reseñas de la ficha se cargan después de hidratar.
- Imágenes en AVIF (WebP de respaldo) con `sizes` ajustados a cada grilla.
- `npm run size` mide el JS de primera carga por ruta (gzip, sin los polyfills
  `noModule`) contra un presupuesto por ruta; CI lo corre en cada PR.
- Lighthouse CI (`lighthouserc.json`, móvil simulado) audita `/`, `/item/1`,
  `/category/helmet` y `/cart`; la última corrida local dio rendimiento 80-82
  (mediana), accesibilidad 100 y buenas prácticas 100. El gate de SEO de CI es
  ≥ 90 en las rutas indexables (`/`, fichas y categorías), y el objetivo es 100,
  que hoy cumplen. `/cart` y `/checkout` son `noindex` a propósito (lo correcto
  en páginas transaccionales), así que no se afirma SEO sobre ellas. `/checkout` no está en
  Lighthouse: sin carrito redirige a `/cart` y el informe mediría esa página;
  su accesibilidad se audita con axe en `e2e/checkout.spec.ts`, paso a paso y
  con un carrito cargado.

## Tests

- `__tests__/integration` (contra la base de test): gateway de datos (búsqueda,
  filtros, orden, paginación, facetas, casos borde), lecturas después de
  escrituras, Route Handlers y proxy, seed (contenido, idempotencia, admin) y las
  restricciones del schema.
- `__tests__/lib`: parser de queries, búsqueda normalizada, caché del catálogo
  (tags e invalidación) y utilidades.
- `__tests__/stores`: stores, selectores, migraciones e hidratación.
- `__tests__/components`: primitivos (`ui/`), carrito lateral, carrito /
  favoritos / comparador, catálogo y filtros, checkout, formularios, galería,
  ficha de producto, reseñas, autocompletado, useProductActions,
  useProductsByIds y suscripciones a los stores.
- `__tests__/config`: cada link de navegación resuelve a una página.
- `__tests__/lint` y `__tests__/design`: guardas de ESLint y contraste de tokens.
- Storybook: cada story se renderiza en Chromium con axe (a11y como error).
- `e2e/`: un archivo por área: `homepage` (inicio), `catalog` (filtros en la URL,
  orden, precio), `search` (búsqueda y combobox), `product` (ficha), `cart`
  (agregar desde tarjetas, carrito lateral, aviso del navbar), `lists`
  (favoritos, comparador y su barra), `checkout` (con axe), `shell` (navbar,
  footer, páginas de información, 404), `state` (estado persistido), `a11y`
  (axe WCAG 2.1 AA en cada página, en modo claro y oscuro) y el proyecto `prod`
  (navegación, transiciones y rutas estáticas sobre el build de producción).

CI (`.github/workflows/ci.yml`): lint, tipos, tests con cobertura, build de
Storybook, build, E2E, auditoría de dependencias de producción, presupuesto de
JS y Lighthouse. Los jobs que necesitan datos levantan un servicio Postgres 17,
corren `prisma migrate deploy` y el seed antes de empezar.

## Licencia

MIT, ver [LICENSE](./LICENSE).
