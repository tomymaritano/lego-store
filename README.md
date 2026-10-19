# LEGO Store

Tienda online de sets LEGO (proyecto de portfolio), con frontend y backend
completos: catálogo con búsqueda, filtros en la URL e infinite scroll, ficha de
producto con reseñas, carrito y favoritos por cuenta, comparador, cupones,
checkout en tres pasos con **Mercado Pago** (tarjetas en cuotas, efectivo, dinero
en cuenta; **Stripe** como alternativa), "Mis pedidos", emails, páginas de ayuda
editables y un panel de admin (catálogo, pedidos con reembolsos, usuarios,
cupones, contenido, configuración, bandeja, métricas y auditoría). Toda la UI
está en español, tiene modo oscuro y apunta a WCAG 2.1 AA.

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

Versiones instaladas (`package-lock.json`):

- **Next.js 16.4** (App Router, Turbopack, `proxy.ts`) + **React 19.3**, TypeScript 5.9
- **PostgreSQL 17** + **Prisma 7** (generador `prisma-client` en `src/generated/prisma`, driver adapter `@prisma/adapter-pg`)
- **Auth.js** (`next-auth@5.0.0-beta.32`): email + contraseña (bcrypt) y Google opcional, sesiones JWT revocables
- **Mercado Pago** (`mercadopago` 3.6, Payment Brick con `@mercadopago/sdk-react` 1.0, Checkout Pro), **Stripe** 23 como alternativa (Payment Element + ConfirmationTokens)
- **Resend** (emails), **Vercel Blob** (imágenes del admin), **sharp** (re-codificación)
- **Tailwind CSS 4.3** con tokens de diseño en `src/app/globals.css`
- Primitivos estilo **shadcn/ui** escritos a mano sobre **Base UI 1.9** (`src/components/ui`), con `class-variance-authority` y `tailwind-merge`
- **motion 14** (`motion/react`, vía `LazyMotion` + `m.*`), presets en `src/lib/motion.ts`
- **Zustand 5** (estado del cliente persistido) y **TanStack Query 5** (datos en islas cliente)
- **React Hook Form 7** + **Zod 4** (se cargan donde se valida un formulario), **Sonner 2** (toasts), **lucide-react** (íconos)
- Barlow por `next/font` (self-hosted y precargada)
- **Vitest 5** (unit, integración contra Postgres y Storybook), **Playwright 1.64** (E2E), **Storybook 10**, **ESLint 9**

Requiere Node `^22.13.0` o `>=24` y Docker para el Postgres local.

## Inicio rápido

```bash
npm install                  # también genera el cliente de Prisma
cp .env.example .env.local
```

En `.env.local`, completa `AUTH_SECRET` (obligatoria) y, para tener un admin en
tu máquina, descomenta `SEED_DEV_ADMIN=1`. Un secreto se genera con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Después:

```bash
npm run db:up                # Postgres 17 en Docker: localhost:5433, bases lego_store y lego_store_test
npm run db:migrate           # aplica las migraciones a lego_store
npm run db:seed              # catálogo, reseñas, pedidos y cupones de ejemplo, contenido y el admin
npm run dev                  # http://localhost:3000
```

- **Admin**: entra en <http://localhost:3000/login> con `admin@lego-store.local`
  / `admin-dev-1234` (el admin de desarrollo de `SEED_DEV_ADMIN=1`, contraseña
  pública, solo para tu máquina) y ve a `/admin`. Para un admin propio, define
  `ADMIN_EMAIL` y `ADMIN_PASSWORD` (juntas) y vuelve a correr `npm run db:seed`.
- **Pagar sin cuentas reales**: agrega `PAYMENTS_MOCK=1` a `.env.local` y reinicia:
  el paso Pago ofrece tarjetas y tickets de prueba simulados. Con credenciales de
  prueba de Mercado Pago o claves de test de Stripe se usa el proveedor de verdad
  ([docs/payments.md](./docs/payments.md)).
- **Cupones del seed**: `BIENVENIDA10` (10 % desde $2.000, una vez por cliente) y
  `LEGO500` ($500 desde $4.000).
- **Tests**: una vez, `npx playwright install chromium`; después `npx vitest run`
  (unit, integración contra `lego_store_test` y stories) y `npm run test:e2e`.
- **Otro puerto para Postgres** (el 5433 ocupado, o una segunda copia del repo):
  `POSTGRES_PORT=5434 npm run db:up` y cambia el puerto en las URLs de
  `.env.local`. Para entrar a la base: `docker compose exec db psql -U lego -d lego_store`.

## Scripts principales

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` / `npm start` | Build de producción (lee la base) y servidor |
| `npm run db:up` / `npm run db:down` | Levanta / detiene Postgres en Docker |
| `npm run db:migrate` / `npm run db:deploy` | Migraciones en dev / solo aplicar (CI, producción) |
| `npm run db:seed` | Seed idempotente |
| `npm run lint` | ESLint (incluye las guardas del sistema de diseño) |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npx vitest run` | Unit + integración + Storybook (`npm test` en modo watch) |
| `npm run test:coverage` | Cobertura |
| `npm run test:e2e` | Playwright: `chromium` (dev, pagos simulados), `prod` (build en el 3100) y `store-ops` |
| `npm run storybook` | Storybook en http://localhost:6006 |
| `npm run size -- <url>` | JS de primera carga por ruta contra su presupuesto, sobre un `npm start` en marcha |
| `npm run screenshots` | Regenera `screenshots/` |

La tabla completa está en [CONTRIBUTING.md](./CONTRIBUTING.md#scripts).

## Documentación

- [Arquitectura](./docs/architecture.md): carpetas, Server vs Client Components,
  flujo de datos, estado del cliente, rutas, SEO y renderizado.
- [Backend](./docs/backend.md): `src/lib`, Prisma, caché y tags, Server Actions y
  Route Handlers, sesión y roles, rate limiting, emails, subidas, auditoría.
- [Modelo de datos](./docs/data-model.md): cada tabla, sus reglas y los estados
  de pedidos, cupones y pagos.
- [Pagos](./docs/payments.md): Mercado Pago y Stripe, webhooks, reembolsos,
  cupones en el total, modo simulado y cómo probar con credenciales de prueba.
- [Panel de admin](./docs/admin.md): cada sección, permisos y efectos de cada
  acción.
- [Deploy](./docs/deploy.md): Vercel + Neon + Mercado Pago + Stripe + Resend +
  Vercel Blob, referencia de variables de entorno y checklist.
- [Sistema de diseño](./docs/design-system.md): tokens, tipografía, primitivos,
  movimiento, guardas de ESLint y cómo agregar un primitivo.
- [Tests y calidad](./docs/testing.md): Vitest, Playwright, mocks, CI,
  presupuestos de JS y Lighthouse.
- [Cómo contribuir](./CONTRIBUTING.md): requisitos, base de datos y migraciones,
  commits y checklist del PR.
- [Changelog](./CHANGELOG.md).
- Diseño y auditorías:
  [spec del backend](./docs/superpowers/specs/2026-10-17-backend-completo-design.md)
  (con las notas de implementación de cada etapa),
  [spec del overhaul de UI](./docs/superpowers/specs/2026-10-17-ui-overhaul-design.md)
  y [auditoría de UI](./docs/superpowers/audits/2026-10-17-auditoria-ui.md).

## En pocas palabras

- **El servidor es la fuente de verdad** de precios, descuentos, totales, stock y
  permisos; toda entrada pasa por zod. El navegador manda ids y cantidades.
- **Datos**: las páginas son Server Components que leen de `src/lib` (Prisma
  detrás del data cache de Next, con tags que cada escritura invalida); las
  islas cliente leen por Route Handlers con React Query y escriben con Server
  Actions.
- **Pagos**: solo "Realizar pedido" cobra, por el total calculado en el servidor,
  con idempotency keys; webhooks firmados e idempotentes; stock descontado de forma
  atómica al acreditarse, con reembolso si falta.
- **Admin**: cada acción verifica el rol en la base y deja su entrada de
  auditoría en la misma transacción.
- **Estado del cliente**: stores de Zustand con selectores y persistencia
  versionada; `StoreHydrator` los carga tras hidratar y un script inline aplica
  el tema antes del primer pintado. Con sesión, carrito y favoritos viven en la
  cuenta.
- **Diseño**: tokens semánticos con contraste AA verificado por tests, guardas de
  ESLint contra colores crudos, `dark:` sueltos y tamaños fuera de la escala;
  axe en claro y oscuro en cada página.
- **Rendimiento**: lecturas compartidas desde el data cache de Next; paneles poco
  usados, Sonner y reseñas cargados bajo demanda; imágenes AVIF; presupuesto de
  JS por ruta en CI. Lighthouse CI exige accesibilidad ≥ 0.95, buenas prácticas
  ≥ 0.9 y SEO ≥ 0.9 en las rutas indexables; rendimiento (≥ 0.8) es un aviso.

## Licencia

MIT, ver [LICENSE](./LICENSE).
