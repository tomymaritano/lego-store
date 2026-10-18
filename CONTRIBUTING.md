# Cómo contribuir

Guía práctica para trabajar en el proyecto. Antes de tocar código, lee
[docs/architecture.md](./docs/architecture.md), [docs/backend.md](./docs/backend.md)
y, si cambias la UI, [docs/design-system.md](./docs/design-system.md).

> Este proyecto usa Next.js 16, que trae cambios que rompen compatibilidad con
> versiones anteriores. Ante la duda, consulta la guía en
> `node_modules/next/dist/docs/` (ver [AGENTS.md](./AGENTS.md)).

## Requisitos

- Node `^22.13.0 || >=24` (campo `engines` de `package.json`; CI usa Node 22).
- npm (el repo tiene `package-lock.json`).
- Docker (Docker Desktop en Windows y macOS) para el Postgres local.
- Chromium de Playwright para el proyecto `storybook` de Vitest y para los E2E.

## Puesta en marcha

Los pasos están en el [README](./README.md#inicio-rápido). En resumen:
`npm install`, `.env.local` a partir de `.env.example` con un `AUTH_SECRET`,
`npm run db:up`, `npm run db:migrate`, `npm run db:seed` y `npm run dev`. Para los
tests en navegador, una vez: `npx playwright install chromium`.

Para probar pagos sin cuentas reales, `PAYMENTS_MOCK=1` en `.env.local` (ver
[docs/payments.md](./docs/payments.md#modo-de-prueba-sin-cuentas-payments_mock1)).

## Scripts

| Script | Comando | Qué hace |
| --- | --- | --- |
| `dev` | `next dev` | Servidor de desarrollo en el puerto 3000 (necesita la base) |
| `build` | `next build` | Build de producción (lee la base) |
| `start` | `next start` | Sirve el build |
| `db:up` / `db:down` | `docker compose up -d --wait` / `down` | Postgres 17 en `localhost:5433` (bases `lego_store` y `lego_store_test`) |
| `db:migrate` | `prisma migrate dev` | Aplica las migraciones pendientes en dev y crea una nueva si cambiaste el schema |
| `db:deploy` | `prisma migrate deploy` | Solo aplica migraciones (CI, producción) |
| `db:seed` | `prisma db seed` | Catálogo, reseñas, pedidos y cupones de ejemplo, configuración, contenido y el admin (idempotente) |
| `db:reset` | `prisma migrate reset && prisma db seed` | Borra la base de dev, reaplica todo y siembra (pide confirmación) |
| `db:studio` | `prisma studio` | Mirar y editar la base |
| `db:generate` | `prisma generate` | Regenera el cliente de Prisma (también en `postinstall`) |
| `lint` | `eslint .` | ESLint, incluidas las guardas del sistema de diseño |
| `test` | `vitest` | Vitest en modo watch (proyectos `unit`, `integration` y `storybook`) |
| `test:unit` / `test:integration` | `vitest run --project …` | Solo unit (sin base) / solo integración (base de test) |
| `test:db:setup` | `tsx scripts/with-test-db.ts prisma migrate reset --force` | Reconstruye la base de test desde cero |
| `test:ui` | `vitest --ui` | Interfaz de Vitest |
| `test:coverage` | `vitest run --coverage` | Una corrida con cobertura |
| `test:e2e` | `playwright test` | Playwright: `chromium` (dev, pagos simulados), `prod` (build en el 3100) y `store-ops` |
| `test:e2e:ui` | `playwright test --ui` | Playwright en modo UI |
| `test:e2e:stripe` | `playwright test --config playwright.stripe-live.config.ts` | Checkout contra Stripe en modo test real (se saltea sin claves) |
| `storybook` / `build-storybook` | `storybook dev -p 6006` / `storybook build` | Storybook |
| `size` | `node scripts/first-load-js.mjs` | JS de primera carga por ruta contra su presupuesto (`npm run size -- <url>`) |
| `screenshots` | `node scripts/take-screenshots.mjs` | Regenera `screenshots/` contra un build en marcha (`BASE_URL` para otro origen) |

Sin script propio: `npx tsc --noEmit` (tipos) y `npx vitest run` (una corrida).
Detalle de cada suite en [docs/testing.md](./docs/testing.md).

## Base de datos y migraciones

- **El schema** es `prisma/schema.prisma`. El cliente se genera en
  `src/generated/prisma` (fuera de git): después de cambiar el schema corre
  `npm run db:generate` (o `db:migrate`, que también lo hace).
- **Una migración nueva**: edita el schema y corre
  `npm run db:migrate -- --name <cambio_en_snake_case>`. Prisma escribe
  `prisma/migrations/<fecha>_<cambio>/migration.sql` y la aplica a tu base de dev.
  Para revisarla o completarla antes de aplicarla:
  `npx prisma migrate dev --create-only --name <cambio>`, edita el SQL y después
  `npm run db:migrate`.
- **Lo que Prisma no escribe va a mano al final del SQL**, bajo un comentario
  `-- Hand-written`: restricciones `CHECK` (stock ≥ 0, totales que cierran, emails
  en minúsculas…), triggers (el de los usos de cupones) y backfills de datos. Si
  una migración recrea una tabla, copia sus `CHECK`. Agrega un caso en
  `__tests__/integration/schema.test.ts` para cada restricción nueva.
- **Nunca edites una migración ya commiteada**: agrega otra. Si tu base de test
  quedó desfasada por una migración editada en tu rama, `npm run test:db:setup`.
- **Datos de ejemplo**: si el cambio necesita datos, actualiza el seed
  (`prisma/seed/`, fuente en `src/data`) manteniéndolo idempotente: lo que pueda
  haber editado una persona (configuración, contenido, cuentas, pedidos) se crea
  solo si falta.
- **Producción**: `npm run db:deploy` (solo aplica lo pendiente). Ver
  [docs/deploy.md](./docs/deploy.md#2-proyecto-en-vercel).
- **Reglas del backend** para código nuevo: toda entrada con zod
  (`src/lib/validations`); precios, totales, stock y permisos se calculan en el
  servidor; una mutación del admin llama a `requireAdminActor()`, escribe su
  entrada de `AuditLog` en la misma transacción e invalida los tags o rutas que
  cambió; una lectura compartida nueva va por el data cache con su tag (ver
  [docs/backend.md](./docs/backend.md)).

## Ramas y commits

- No trabajes directo sobre `main`. Usa una rama por tema con prefijo de tipo:
  `feat/…`, `fix/…`, `docs/…`, `refactor/…` (por ejemplo `feat/ui-overhaul`,
  `feat/backend`).
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):
  `tipo(ámbito opcional): resumen`. Tipos que usa el repo: `feat`, `fix`,
  `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ci`, `chore`. Ejemplos
  del historial: `feat(seo): sitemap.xml and robots.txt from the database`,
  `fix(admin): the inbox keeps the keyboard focus, and its filters fit`.
- El resumen describe el cambio en una línea; el cuerpo, si hace falta, explica
  el porqué.
- Un commit, un cambio coherente, y cada commit compila. No mezcles un refactor
  con un cambio de comportamiento.
- Nunca commitees secretos: `.env.local` está en `.gitignore`.

## Checklist del PR

- [ ] `npm run lint` sin errores (incluye las guardas del sistema de diseño: nada
      de colores crudos, `dark:` fuera de `ui/`, duraciones numéricas ni
      `text-sm`/`text-2xl` en código de app, ni imports de `@/data`).
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npx vitest run` en verde (unit + integración + stories con a11y).
- [ ] `npm run build` en verde.
- [ ] `npm run test:e2e` en verde si el cambio toca flujos, rutas, pagos o estado.
- [ ] Tests nuevos o actualizados para el comportamiento que cambia (unit,
      integración contra la base de test y E2E según corresponda). Si tocaste una
      guarda o un token, actualiza `__tests__/lint/guardrails.test.ts` o
      `__tests__/design/tokens.test.ts`.
- [ ] Migraciones nuevas con sus `CHECK` a mano y el seed al día.
- [ ] Componentes de UI nuevos: story en claro y oscuro, sin violaciones de axe
      (ver "Cómo agregar un primitivo" en [docs/design-system.md](./docs/design-system.md)).
- [ ] Si el cambio suma JS al cliente, `npm run size` dentro del presupuesto.
- [ ] Cambios visibles: capturas antes/después en claro y oscuro (y en móvil si
      aplica) en la descripción del PR. Si cambian las capturas del README,
      regenéralas con `npm run screenshots`.
- [ ] Variables de entorno nuevas en `.env.example` y en la referencia de
      [docs/deploy.md](./docs/deploy.md#variables-de-entorno).
- [ ] Docs actualizadas si cambian la arquitectura, el modelo de datos, los pagos,
      el admin, los scripts o los tests, y entrada en [CHANGELOG.md](./CHANGELOG.md)
      si es un cambio visible.
- [ ] Textos de la UI en español con tuteo ("Revisa", "Completa"), como el resto
      de la app.
