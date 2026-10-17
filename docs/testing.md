# Tests y calidad

Qué se prueba, con qué herramienta, cómo correrlo y qué corre CI.

## Resumen

| Capa | Herramienta | Dónde | Comando |
| --- | --- | --- | --- |
| Unit y componentes | Vitest (proyecto `unit`, jsdom) + Testing Library | `__tests__/**`, `src/**/*.test.{ts,tsx}` | `npx vitest run --project unit` |
| Stories + a11y | Vitest (proyecto `storybook`, Chromium real) + addon a11y | `src/**/*.stories.tsx` | `npx vitest run --project storybook` |
| E2E (dev) | Playwright, proyecto `chromium` | `e2e/*.spec.ts` | `npx playwright test --project chromium` |
| E2E (build de producción) | Playwright, proyecto `prod` | `e2e/prod/*.spec.ts` | `npx playwright test --project prod` |
| Lint y guardas | ESLint 9 (flat config) | `eslint.config.mjs` | `npm run lint` |
| Tipos | TypeScript | `tsconfig.json` | `npx tsc --noEmit` |
| JS de primera carga | `scripts/first-load-js.mjs` | presupuestos por ruta | `npm run size -- <url>` |
| Lighthouse | Lighthouse CI | `lighthouserc.json` | en CI (job `lighthouse`) |

## Vitest

Configuración en `vitest.config.mts`, con dos proyectos:

- **`unit`**: entorno `jsdom`, `globals: true`, setup en `__tests__/setup.tsx`
  (jest-dom, mocks de `next/navigation` y `next/image`, `localStorage.clear()`
  antes de cada test, stub de `IntersectionObserver`). El alias `server-only`
  apunta a un módulo vacío para poder probar `src/lib/api` directo.
- **`storybook`**: `@storybook/addon-vitest` renderiza cada story en Chromium
  headless (`@vitest/browser-playwright`). `.storybook/preview.tsx` configura
  `a11y: { test: "error" }`, así que una violación de axe hace fallar la story.

Comandos:

```bash
npm test                          # watch, los dos proyectos
npx vitest run                    # una corrida, los dos proyectos
npx vitest run --project unit     # solo unit (no necesita navegador)
npx vitest run --project storybook
npm run test:coverage             # cobertura v8 (text, json, html en coverage/)
npm run test:ui                   # interfaz de Vitest
```

El proyecto `storybook` necesita Chromium de Playwright:
`npx playwright install chromium`.

La cobertura mide `src/**/*.{ts,tsx}` sin stories, `src/types` ni `src/app`.

### Qué hay en `__tests__`

- `lib/`: gateway de datos (`api.test.ts`: búsqueda, filtros, orden, paginación,
  facetas), `productQuery`, Route Handlers (`routes.test.ts`), precios, tarjetas,
  comparador, metadata, validaciones, `cn`, `pluralize`, resaltado de búsqueda.
- `stores/`: cada store, selectores, migraciones, `restorePosition` e hidratación.
- `components/`: primitivos (`ui/`), carrito lateral, carrito / favoritos /
  comparador, catálogo y filtros, checkout, formularios, galería, ficha, reseñas,
  autocompletado, `useProductActions`, `useProductsByIds`, `useScrollEdges`,
  suscripciones a stores.
- `config/navigation.test.ts`: cada link de navegación resuelve a una página.
- `design/tokens.test.ts`: contraste AA de los tokens en claro y oscuro (ver
  [design-system.md](./design-system.md#contraste)).
- `lint/guardrails.test.ts`: casos que las guardas de ESLint deben marcar y
  casos que deben dejar pasar.
- `helpers/render.tsx`: `renderWithQuery` (React Query sin reintentos ni caché) y
  `mockFetch` (stub de `fetch` con JSON).

### Convenciones

- Un archivo `*.test.ts(x)` por módulo o área, en la carpeta de `__tests__` que
  corresponda a su capa.
- Componentes: consulta por rol y nombre accesible (`getByRole("button", { name:
  … })`), interacción con `@testing-library/user-event`.
- Componentes que usan React Query: `renderWithQuery` y `mockFetch` en vez de
  mockear `@/lib/api-client`.
- Tests que corren en Node (por ejemplo el de guardas) declaran
  `// @vitest-environment node`.
- Si tocas una guarda de ESLint o un token de color, actualiza su test.

## Playwright

Configuración en `playwright.config.ts`:

- **`chromium`**: Desktop Chrome contra `npm run dev` en `http://localhost:3000`.
  Ignora `e2e/prod/**`. Antes de los workers, `e2e/global-setup.ts` compila cada
  ruta una vez (evita errores de manifest en un `next dev` frío).
- **`prod`**: Desktop Chrome contra un build de producción en
  `http://localhost:3100` (`npm run build && npx next start -p 3100`, con
  `NEXT_DIST_DIR=.next-e2e` para no pisar el `.next` de dev). Prueba lo que solo
  muestra el build: navegación del lado del cliente, transición de página, 404
  reales, categorías prerenderizadas que aplican los filtros de la URL y que el
  texto del hero no esté oculto antes de hidratar.

Playwright levanta los dos servidores si no están corriendo (fuera de CI reutiliza
los que ya estén). En CI: `retries: 2`, `workers: 1`, `forbidOnly`.

```bash
npm run test:e2e                     # los dos proyectos
npx playwright test --project chromium
npx playwright test --project prod
npm run test:e2e:ui                  # modo UI
npx playwright show-report           # reporte HTML
```

Specs por área: `homepage`, `catalog` (filtros en la URL, orden, precio), `search`
(búsqueda y combobox), `product`, `cart`, `lists` (favoritos, comparador y su
barra), `checkout` (con axe en cada paso), `shell` (navbar, footer, páginas de
información, 404), `state` (estado persistido) y `a11y` (axe WCAG 2.1 A/AA + best
practices en cada página, en claro y oscuro).

Convenciones:

- Selectores por rol y nombre accesible, como en Vitest.
- Para sembrar estado persistido usa `page.addInitScript` escribiendo
  `localStorage` con `{ state, version: 1 }` (ver `e2e/a11y.spec.ts`).
- Para auditar accesibilidad usa `seriousAxeViolations(page)` de
  `e2e/helpers/axe.ts` dentro de `expect.poll` (las animaciones de entrada tienen
  que terminar antes de medir contraste). Falla con violaciones `serious` o
  `critical`.

## CI (`.github/workflows/ci.yml`)

Corre en push y pull request a `main` y `develop`, con Node 22.

| Job | Qué hace | Cuándo |
| --- | --- | --- |
| `lint` | `npm run lint` y `npx tsc --noEmit` | siempre |
| `test` | instala Chromium, `npm run test -- --run --coverage` (unit + storybook), sube la cobertura y corre `npm run build-storybook -- --quiet` | siempre |
| `build` | `npm run build` y sube `.next/` | después de `lint` y `test` |
| `e2e` | instala Chromium y corre `npx playwright test` (los dos proyectos) | después de `build` |
| `lighthouse` | build y Lighthouse CI con `lighthouserc.json` (reportes como artefactos, sin almacenamiento público) | solo en PR, después de `build` |
| `security` | `npm audit --omit=dev --audit-level=high` (bloquea) y `npm audit --audit-level=high` (solo informa) | siempre |
| `bundle-size` | build, `npm run start -- -p 3311` y `npm run size -- http://localhost:3311` | solo en PR, después de `build` |

## Presupuestos de JS

`npm run size` (`scripts/first-load-js.mjs`) suma el tamaño gzip de cada
`<script src>` que carga el HTML de una ruta (sin los polyfills `noModule`) y lo
compara con su presupuesto. Sale con código 1 si alguna ruta se pasa.

| Ruta | Presupuesto (kB gzip) |
| --- | --- |
| `/` | 265 |
| `/item/1` | 296 |
| `/category/helmet` | 330 |
| `/search?q=star` | 330 |
| `/cart` | 262 |
| `/wishlist` | 262 |
| `/compare` | 264 |
| `/checkout` | 322 |

Corre contra un servidor de producción ya levantado (por defecto
`http://localhost:3000`):

```bash
npm run build
npm run start -- -p 3311
npm run size -- http://localhost:3311
```

Los presupuestos están ~5 % por encima de lo medido la última vez que se bajaron:
son una guarda contra regresiones. Si recortas JS, bájalos en el script.

## Lighthouse CI

`lighthouserc.json` levanta `npm run start` y audita, 3 corridas cada una, `/`,
`/item/1`, `/category/helmet` y `/cart`.

| Categoría | Nivel | Mínimo | Rutas |
| --- | --- | --- | --- |
| Performance | `warn` | 0.8 | todas |
| Accessibility | `error` | 0.95 | todas |
| Best practices | `error` | 0.9 | todas |
| SEO | `error` | 0.9 | `/`, `/item/*`, `/category/*` (indexables) |

`/cart` es `noindex`, por eso no se le exige SEO. `/checkout` no está: sin carrito
redirige a `/cart`; su accesibilidad la cubre `e2e/checkout.spec.ts` con axe.
Performance sigue como aviso porque las medianas locales están demasiado cerca de
0.8 para el ruido de un runner (ver el comentario en `ci.yml`).
