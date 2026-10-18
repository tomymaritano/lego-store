# Tests y calidad

Qué se prueba, con qué herramienta, cómo correrlo y qué corre CI.

## Resumen

| Capa | Herramienta | Dónde | Comando |
| --- | --- | --- | --- |
| Unit y componentes | Vitest (proyecto `unit`, jsdom) + Testing Library | `__tests__/**` (salvo `integration/`), `src/**/*.test.{ts,tsx}` | `npm run test:unit` |
| Integración (base de test) | Vitest (proyecto `integration`, Node) | `__tests__/integration/**` | `npm run test:integration` |
| Stories + a11y | Vitest (proyecto `storybook`, Chromium real) + addon a11y | `src/**/*.stories.tsx` | `npx vitest run --project storybook` |
| E2E (dev, pagos simulados) | Playwright, proyecto `chromium` | `e2e/*.spec.ts` | `npx playwright test --project chromium` |
| E2E (build de producción) | Playwright, proyecto `prod` | `e2e/prod/*.spec.ts` | `npx playwright test --project prod` |
| E2E (configuración de la tienda) | Playwright, proyecto `store-ops` | `e2e/store-ops/*.spec.ts` | corre con `npx playwright test` |
| E2E contra Stripe test real | Playwright, config aparte | `e2e/stripe-live/` | `npm run test:e2e:stripe` |
| Lint y guardas | ESLint 9 (flat config) | `eslint.config.mjs` | `npm run lint` |
| Tipos | TypeScript | `tsconfig.json` | `npx tsc --noEmit` |
| JS de primera carga | `scripts/first-load-js.mjs` | presupuestos por ruta | `npm run size -- <url>` |
| Lighthouse | Lighthouse CI | `lighthouserc.json` | en CI (job `lighthouse`) |

Antes de la primera corrida: Postgres levantado (`npm run db:up`), la base de dev
migrada y sembrada (la usan los E2E) y Chromium de Playwright
(`npx playwright install chromium`). La base de test se migra sola.

## Vitest

Configuración en `vitest.config.mts`, con tres proyectos:

- **`unit`**: entorno `jsdom`, `globals: true`, setup en `__tests__/setup.tsx`
  (jest-dom, mocks de `next/navigation` y `next/image`, `localStorage.clear()`
  antes de cada test, stub de `IntersectionObserver`). El alias `server-only`
  apunta a un módulo vacío para poder probar `src/lib` directo. No usa la base.
- **`integration`**: entorno `node`, contra la base de `DATABASE_URL_TEST` (su
  nombre tiene que contener "test"). El setup global toma un advisory lock de la
  base (una segunda corrida a la vez, por ejemplo `npm test` en modo watch
  abierto, falla enseguida diciendo que la base está ocupada) y aplica las
  migraciones pendientes; cada archivo vacía las tablas y vuelve a sembrar lo que
  usa (`resetAndSeed`, `__tests__/integration/setup/db.ts`). Los archivos corren
  uno tras otro (`fileParallelism: false`), con 30 s por test.
  `worker-setup.ts` apunta `DATABASE_URL` a la base de test y reemplaza
  `next/cache` (el data cache pasa directo y las revalidaciones quedan
  registradas para verificarlas). Si la base de test se desfasó de las
  migraciones (una migración editada), `npm run test:db:setup` la reconstruye.
- **`storybook`**: `@storybook/addon-vitest` renderiza cada story en Chromium
  headless. `.storybook/preview.tsx` configura `a11y: { test: "error" }`, así que
  una violación de axe hace fallar la story.

Comandos:

```bash
npm test                          # watch, los tres proyectos
npx vitest run                    # una corrida, los tres proyectos
npm run test:unit                 # solo unit (sin base ni navegador)
npm run test:integration          # solo integración (base de test)
npx vitest run --project storybook
npm run test:coverage             # cobertura v8 (text, json, html en coverage/)
npm run test:ui                   # interfaz de Vitest
```

La cobertura mide `src/**/*.{ts,tsx}` sin stories, `src/types`, `src/app` ni
`src/generated`.

### Qué hay en `__tests__`

- `integration/`: gateway de datos (búsqueda, filtros, orden, paginación,
  facetas) y lecturas después de escrituras; Route Handlers y proxy; seed y
  restricciones del schema; cuentas, sesiones y revocación; rate limiter en
  Postgres; carrito y favoritos (fusión, topes de stock); reseñas y ratings;
  checkout de Stripe y su webhook firmado; Mercado Pago (`mercadopago.test.ts`:
  el total del servidor es lo que se cobra, aprobado / ticket / en revisión /
  rechazado / vencido / reembolsado / contracargo, firma, idempotencia,
  notificaciones tardías, carrera por la última unidad, Checkout Pro, limpieza);
  cupones (reservas, límites, concurrencia, trigger); admin (`admin-*.test.ts`,
  `catalog-admin`, `store-settings`, `content-pages`, `inbox-newsletter`,
  `dashboard-report`, `exports`, `uploads`: cada acción, su auditoría y sus
  permisos); `sitemap.test.ts` (lo que lista `/sitemap.xml`).
- `lib/`: lógica pura: precios y cupones, firma `x-signature` comparada con el
  validador del SDK oficial, estados de Mercado Pago, la pasarela de Stripe con el
  SDK simulado, configuración de pagos, emails, CSV, auditoría, subidas, sitemap y
  robots, rate limiter, búsqueda, `productQuery`, metadata…
- `stores/`: cada store, selectores, migraciones, hidratación y la capa optimista
  contra el servidor (`listsRemote`).
- `components/`: primitivos (`ui/`), carrito, catálogo y filtros, checkout (Stripe
  y Mercado Pago), cupón, formularios, galería y subidas, ficha, reseñas,
  autocompletado, gráficos del admin, `ListsSync`…
- `config/navigation.test.ts`: cada link de navegación resuelve a una página.
- `design/tokens.test.ts`: contraste AA de los tokens en claro y oscuro.
- `lint/guardrails.test.ts`: casos que las guardas de ESLint deben marcar y dejar
  pasar.
- `helpers/`: `renderWithQuery`, `mockFetch`, fábricas de catálogo y pedidos.

### Mocks y dobles

- **Pagos**: los tests de integración usan los proveedores simulados de
  `src/lib/payments/mock.ts` y `src/lib/payments/mercadopago/mock.ts` (los mismos
  que `PAYMENTS_MOCK=1`) o un doble del cliente pasado por argumento; los webhooks
  se firman con los secretos de test (`signMercadoPagoNotification`, la firma de
  Stripe). Los de Stripe corren con `PAYMENT_PROVIDER=stripe`.
- **Sesión**: `vi.mock("@/lib/auth")` con una sesión de prueba; las Server
  Actions se importan y se llaman directo.
- **Next**: `next/cache` reemplazado en `worker-setup.ts`; `redirect` y
  `forbidden` se simulan tirando el error que lanzaría Next.
- **Emails**: sin `RESEND_API_KEY` van a la consola.
- **Subidas**: el adaptador de disco con `UPLOADS_DIR` en una carpeta temporal.

### Convenciones

- Un archivo `*.test.ts(x)` por módulo o área, en la carpeta de su capa.
- Componentes: consulta por rol y nombre accesible, interacción con
  `@testing-library/user-event`; con React Query, `renderWithQuery` y
  `mockFetch`.
- Tests que corren en Node fuera de `integration/` declaran
  `// @vitest-environment node`.
- Lo que toca la base va en `integration/`, nunca en `unit`.
- Si tocas una guarda de ESLint o un token de color, actualiza su test.

## Playwright

Configuración en `playwright.config.ts`:

- **`chromium`**: Desktop Chrome contra `next dev` en el puerto 3000, levantado
  con `PAYMENTS_MOCK=1` y los secretos de webhook de test
  (`E2E_SERVER_ENV`, `e2e/helpers/stripe.ts`). La tienda cobra con Mercado Pago
  simulado; los specs de Stripe (`checkout`, `orders`, `admin`) ponen en su
  navegador la cookie `payments-mock-provider=STRIPE`.
- **`prod`**: un build de producción en el puerto 3100 (`next build` en
  `.next-e2e` y `next start`). Prueba lo que solo muestra el build: navegación,
  transiciones, códigos de estado, headers de seguridad, `/sitemap.xml` y
  `/robots.txt`, y que sin claves del proveedor el admin ve "Cancelar"
  deshabilitado (un build nunca usa los pagos simulados).
- **`store-ops`**: corre después de `chromium` y `prod`, solo: cambia el costo de
  envío y el FAQ desde el admin (lo que ven todas las páginas) y los deja como
  estaban.

Playwright arranca primero el build y después `next dev`. Fuera de CI reutiliza
lo que ya escuche en esos puertos; el setup global comprueba que el dev server
corre con el mock y es **el de esta copia con su base de datos** (compara un hash
de la carpeta y `DATABASE_URL` con el de `GET /api/test/identity`, que solo
existe con `PAYMENTS_MOCK=1`), y que el de producción sirve el build de esta
copia. Si no coincide, el setup se detiene en vez de escribir en otra base. Para
correr al lado de otros servidores: `E2E_DEV_PORT=3010 E2E_PROD_PORT=3110 npx
playwright test`; no corras dos suites a la vez en la misma máquina (comparten
CPU y los límites por IP de la base). Localmente usa 4 workers (`E2E_WORKERS`
lo cambia): con más, el único `next dev` compilando rutas y bcrypt en cada login
hacían vencer esperas de rutas frías. En CI: `retries: 2`, `workers: 1`,
`forbidOnly`.

**Datos de los E2E**: usan la base de dev. Las cuentas, pedidos, mensajes y
suscripciones de los specs usan emails `@e2e.lego-store.test`; el setup global los
borra (devolviendo el stock que tomaron), limpia los contadores de rate limiting y
crea un admin con contraseña aleatoria, y el teardown vuelve a borrarlos. Una
corrida hace 20 registros por el formulario (el límite por IP por hora): un spec
nuevo que necesite una cuenta debe usar `createE2eAccount` (`e2e/helpers/db.ts`).

**Pagos en los E2E**: `mercadopago.spec.ts` (tarjeta aprobada, rechazada y otra que
paga, ticket pendiente que se acredita por webhook firmado, firma inválida, con axe
en claro y oscuro), `checkout.spec.ts` (Stripe hasta PAID), `orders.spec.ts`
(compra con cuenta → Mis pedidos), `coupons.spec.ts`, `admin.spec.ts` (enviar y
entregar un pedido pagado). Lo que Mercado Pago haría solo (acreditar un ticket,
pagar una preferencia) lo pide el spec a `POST /api/test/mercadopago` y después
manda la notificación firmada (`e2e/helpers/mercadopago.ts`).

```bash
npm run test:e2e                     # chromium, prod y store-ops
npx playwright test --project chromium
npx playwright test --project prod
npm run test:e2e:ui                  # modo UI
npx playwright show-report           # reporte HTML
```

Specs por área: `homepage`, `catalog`, `search`, `product`, `cart`, `lists`,
`account-lists`, `auth`, `reviews`, `checkout`, `mercadopago`, `orders`,
`coupons`, `newsletter`, `admin`, `admin-catalog`, `shell`, `state`,
`security-headers` y `a11y` (axe WCAG 2.1 A/AA en cada página, claro y oscuro,
incluidas Mis pedidos y cada sección del admin).

Convenciones:

- Selectores por rol y nombre accesible.
- Estado persistido: `page.addInitScript` escribiendo `localStorage` con
  `{ state, version: 1 }`.
- Accesibilidad: `seriousAxeViolations(page)` de `e2e/helpers/axe.ts` dentro de
  `expect.poll`.

### E2E contra Stripe en modo test

`npm run test:e2e:stripe` (`playwright.stripe-live.config.ts`, `e2e/stripe-live`):
con claves de **test** (`sk_test_`/`pk_test_` y `STRIPE_WEBHOOK_SECRET`) levanta su
propio `next dev` en el 3200 sin mock, completa el Payment Element con `4242…` y
con la tarjeta 3D Secure, comprueba que Stripe cobró el total del servidor y
entrega al webhook el evento real. Sin claves se saltea. No hay un equivalente
contra Mercado Pago real.

### Qué no cubre ningún test automático

- Pagar contra un build de producción (un build nunca usa los pagos simulados).
- El Payment Brick y Checkout Pro reales, y la secuencia de un contracargo, contra
  credenciales de Mercado Pago.
- Vercel Blob con un token real (solo el adaptador de disco).

Ver la checklist de [deploy.md](./deploy.md#después-del-deploy).

## CI (`.github/workflows/ci.yml`)

Corre en push a `main`, `develop` y las ramas `feat/**` (por ejemplo
`feat/backend`), y en pull requests hacia `main`, `develop` o una rama `feat/**`
(un PR apilado sobre otra rama de feature también tiene CI), con Node 22. Los jobs que
necesitan datos levantan un servicio Postgres 17, corren `prisma migrate deploy`
y el seed antes de empezar, y generan un `AUTH_SECRET` descartable.

| Job | Qué hace | Cuándo |
| --- | --- | --- |
| `lint` | `npm run lint` y `npx tsc --noEmit` | siempre |
| `test` | crea `lego_store_test`, migra y siembra, instala Chromium, `npm run test -- --run --coverage` (unit + integración + storybook), sube la cobertura y corre `npm run build-storybook -- --quiet` | siempre |
| `build` | migra y siembra, `npm run build` y sube `.next/` | después de `lint` y `test` |
| `e2e` | migra y siembra, instala Chromium y corre `npx playwright test` (`chromium`, `prod` y `store-ops`) | después de `build` |
| `e2e-stripe-live` | `npm run test:e2e:stripe` contra Stripe en modo test; los pasos se saltean si el repo no tiene los secrets `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y `STRIPE_WEBHOOK_SECRET` | después de `build` |
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
