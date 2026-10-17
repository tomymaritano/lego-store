# Auditoría UI, sistema de diseño y dependencias — 2026-10-17

Auditoría de solo lectura (no se modificó código). Tres frentes: arquitectura de
componentes, sistema de diseño + accesibilidad, dependencias.

## 1. Componentes y arquitectura

### Alta
- **H1. La capa de API no se usa.** `src/lib/api/*` no tiene ningún import. Páginas que
  leen `@/data/products` directo: `app/page.tsx:8`, `item/[productId]/page.tsx:8`,
  `item/[productId]/layout.tsx:2`, `category/[categoryId]/page.tsx:2`, `search/page.tsx:7`,
  `wishlist/page.tsx:10`, `components/search/SearchAutocomplete.tsx:9`. Como el
  autocompletado está en la Navbar, el catálogo entero (619 líneas) viaja en el bundle de
  cliente de todas las páginas. React Query está montado pero nadie llama `useQuery`.
- **H2. Tres búsquedas distintas que dan resultados distintos**: `search/page.tsx:15-26`
  (substring completo) vs `SearchAutocomplete.tsx:64-77` y `lib/api/products.ts:55,145`
  (todos los términos).
- **H3. "use client" en todas las páginas** salvo category. Home es cliente solo por
  animaciones; producto sin `generateStaticParams`; 5 `layout.tsx` existen solo para
  `metadata`.
- **H4. `useHydration` en 11 lugares** (incluye cada `ProductCard`); `ThemeToggle`
  reimplementa lo mismo.
- **H5. Componentes grandes muertos**: `ProductFilters.tsx` (365 líneas), `ProductSort`,
  `CompareButton`, `ErrorBoundary`, `ThemeSelector`, 4 skeletons, variantes de animación.
  Consecuencia: **category, home y search no tienen filtros ni orden en la UI.**

### Media
- **M1. Archivos gigantes**: `checkout/page.tsx` 730 (4 pasos adentro),
  `ProductFilters` 365, `SearchAutocomplete` 306, `app/page.tsx` 306, `item page` 302,
  `ProductReviews` 301 (form con 5 `useState`), `Footer` 260 ("use client" sin motivo),
  `ProductCard` 258, `QuickViewModal` 257.
- **M2. Lógica de carrito/wishlist/comparar copiada** en `ProductCard:24-73`,
  `QuickViewModal:26-51`, `item page:29-64`, `CompareButton:20-38`, `compare/page:58`.
- **M3. Duplicados**: tipos `CartItem/CartState/WishlistItem/WishlistState` en
  `types/index.ts` y en stores; `SortOption` y `ProductFilters` duplicados;
  `useDebounce` (sin uso) vs `useDebouncedValue`; `debounce` en utils sin uso.
- **M4. Stores Zustand**: derivados como funciones (`getTotalPrice`, etc.);
  `useCompareStore()` sin selector re-renderiza todas las cards; compare/recently-viewed
  guardan snapshots completos de producto (se desactualizan con backend); tema aplicado en
  3 lugares sin script en `<head>` (flash de tema); `checkoutStore` guarda número de
  tarjeta y CVV.
- **M5. i18n no se usa**: `I18nProvider` nunca se monta; ~175 strings en español
  hardcodeados; `en.ts` cubre ~la mitad de `es.ts`; locale inconsistente (es-AR en
  precios, es_MX en OpenGraph).
- **M6. JSX repetido**: empty states en 7 archivos; `<Link><Button>` anidado (HTML
  inválido) ~17 veces; breadcrumbs a mano en category.

### Baja
- Solo `error/loading/not-found` en raíz, sin `global-error.tsx`; hack
  `params instanceof Promise` en item; tracking de vistos recientemente no se resetea al
  navegar entre productos.
- 14 archivos con `gray-*` crudo; código sin uso (`siteConfig`, `checkoutSchema`,
  `ApiResponse`, `PaginationParams`).
- Tests: unitarios solo de stores; 4 E2E; 5 stories. Sin tests de componentes.

## 2. Sistema de diseño y accesibilidad

### Alta
- **Input y Breadcrumbs ignoran tokens y se rompen en dark mode** (`Input.tsx:17-38`
  gray/red crudo; `Breadcrumbs.tsx:24,36,41` `text-gray-900` casi invisible en oscuro;
  `ErrorBoundary`, `CompareButton` con `bg-white`).
- **262 clases de paleta cruda** vs 383 semánticas; 24 `dark:` ad-hoc. Peores:
  `ProductReviews` 22, `Footer` 21, `ErrorBoundary` 11, `ProductFilters` 9,
  `ThemeToggle` 7.
- **Modales/drawers inaccesibles**: 0 `role="dialog"`, 0 `aria-modal`, sin Escape, sin
  focus trap ni retorno de foco (`Drawer`, `QuickViewModal`).
- **Labels de formulario sin asociar**: 0 `htmlFor` en 22 labels; errores sin
  `aria-invalid`/`aria-describedby`; `Input` no soporta label.
- **Contraste** (explica el 79 de a11y en Lighthouse): `--text-muted #a8a29e` ≈2.5:1
  (65 usos); blanco sobre success ≈2.3:1 y warning ≈2.1:1 (Badge); blanco sobre
  lego-blue ≈3.7:1 con `text-[10px]`.

### Media
- Clases `.btn/.card/.input/.badge/.price` en `globals.css:251-351` sin ningún uso y
  distintas de los primitivos.
- Primitivos existentes reimplementados: Badge (2 usos, badges a mano en ProductCard y
  QuickView), QuantitySelector duplicado, Input con `inputClassName` propio en checkout.
- Primitivos faltantes reinventados: Rating (5 archivos), Price (5), Card, IconButton
  (~20), Checkbox/Radio/Range, Select, Textarea, Dialog, Tabs, EmptyState. 45 `<button>`
  crudos vs 47 `<Button>`.
- Botones de ícono sin nombre accesible (QuickView, Navbar, SearchAutocomplete, item).
- API de primitivos inconsistente (forwardRef solo en 2, sin cva, Skeleton con dos
  animaciones en conflicto, Toast con colores crudos).
- Framer Motion ignora `prefers-reduced-motion` (21 archivos); transiciones sueltas.
- Sin tokens de radius ni motion; `fade-in`/`slide-up` definidos dos veces con valores
  distintos.

### Baja
- Foco: `focus:` en vez de `focus-visible:`; anillo amarillo sobre blanco ≈1.6:1.
- Sombras crudas que no cambian en dark mode.
- Sin escala tipográfica para body/label; headings sobreescritos inline.
- Storybook: 4 de 11 primitivos; no prueba dark mode; a11y en `todo`.

### Propuesta de capa de tokens y primitivos
- Tokens en CSS vars, tres niveles: primitivos (`--yellow-400`, `--stone-*`), semánticos
  (`--color-bg`, `--color-fg`, `--color-fg-muted` ≥4.5:1, `--color-primary/-hover/on-`,
  `--color-danger`, `--color-success`, `--color-focus-ring`, `--color-rating`…), y de
  componente donde haga falta. Radius, sombras dark-aware, duraciones/easing y escala
  tipográfica (`caption` ≥12px, `label`, `body`, `title`, `display`).
- Primitivos con cva + `cn` + Radix para comportamiento: Button, IconButton (label
  obligatorio), Input/Textarea/Field, Select, Checkbox, RadioGroup, Slider, Dialog,
  Drawer, Tabs, Card, Badge, Rating, Price, EmptyState, Skeleton, QuantitySelector. Cada
  uno con story light/dark y a11y como error.
- Guardas: lint/CI que prohíba paleta cruda y `dark:` fuera de `ui/`;
  `<MotionConfig reducedMotion="user">` y `lib/motion.ts` compartido.

## 3. Dependencias

Node local 22.18, CI en Node 20. Varias versiones nuevas piden Node ≥22.12 o 24
(Vitest 5, jsdom 30, ESLint 10). **Pasar CI y local a Node 24 LTS.**

| Paquete | Actual → Última | Riesgo |
|---|---|---|
| next / eslint-config-next | 14.2.33 → 16.4.2 | Alto |
| react / react-dom | 18.3.1 → 19.3.1 | Medio |
| tailwindcss | 3.4.18 → 4.3.3 | Alto |
| eslint | 8.57 → 10.13 (**apuntar a 9**: plugins de next no soportan 10) | Alto |
| framer-motion | 12.23 → `motion` 14.3 | Medio |
| lucide-react | 0.556 → 1.58 (sin íconos de marcas → Footer) | Medio |
| vitest / vite / plugin-react / jsdom | 4 / 7 / 5 / 27 → 5 / 8 / 6 / 30 | Medio |
| typescript | 5.9 → 7.0 (**quedarse en 5.9**) | Alto |
| storybook, playwright, tanstack, zod, zustand, RHF, etc. | menores | Bajo |

**A eliminar**: `react-hot-toast` (sin uso), `keen-slider` (sin uso),
`@storybook/nextjs` (se usa `nextjs-vite`; cambiar imports de tipos en preview y 5
stories), `playwright` (redundante con `@playwright/test`). Mover
`@tanstack/react-query-devtools` a devDependencies.

**Camino de actualización**
0. Node 24 + quitar deps + bumps menores.
1. ESLint 9 flat config (`next lint` desaparece en Next 16 → `eslint .`).
2. Next 14 → 16 + React 19 (codemod; quitar hack de `params`; `priority` → `preload` en
   `page.tsx:101`, `Navbar.tsx:60`, `ImageZoom.tsx:53,123`; Turbopack por defecto).
3. Tailwind 4 (`@tailwindcss/postcss`, `@import "tailwindcss"`, `@theme`, dark como
   `@custom-variant`, renombres `shadow-sm→shadow-xs`, `rounded→rounded-sm`,
   `outline-none→outline-hidden`, `ring` 3px→1px, `bg-gradient-to→bg-linear-to`, etc.).
4. lucide 1.x (íconos de redes en Footer) + `motion/react`.
5. Toolchain de tests (Vite 8, Vitest 5, jsdom 30).
6. Postergar TypeScript 7 y ESLint 10.
