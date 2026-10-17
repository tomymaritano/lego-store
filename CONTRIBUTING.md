# Cómo contribuir

Guía práctica para trabajar en el frontend. Antes de tocar código, lee
[docs/architecture.md](./docs/architecture.md) y
[docs/design-system.md](./docs/design-system.md).

> Este proyecto usa Next.js 16, que trae cambios que rompen compatibilidad con
> versiones anteriores. Ante la duda, consulta la guía en
> `node_modules/next/dist/docs/` (ver [AGENTS.md](./AGENTS.md)).

## Requisitos

- Node `^22.13.0 || >=24` (campo `engines` de `package.json`; CI usa Node 22).
- npm (el repo tiene `package-lock.json`).
- Chromium de Playwright para el proyecto `storybook` de Vitest y para los E2E.

## Puesta en marcha

```bash
npm ci
npx playwright install chromium   # una vez
npm run dev                       # http://localhost:3000
```

No hace falta ningún `.env` para desarrollar. La única variable que lee la app es
`NEXT_PUBLIC_SITE_URL` (origen absoluto para canonical y Open Graph; por defecto
`http://localhost:3000`). `NEXT_DIST_DIR` cambia la carpeta del build (la usa
Playwright).

## Scripts

| Script | Comando | Qué hace |
| --- | --- | --- |
| `dev` | `next dev` | Servidor de desarrollo en el puerto 3000 |
| `build` | `next build` | Build de producción |
| `start` | `next start` | Sirve el build |
| `lint` | `eslint .` | ESLint, incluidas las guardas del sistema de diseño |
| `test` | `vitest` | Vitest en modo watch (proyectos `unit` y `storybook`) |
| `test:ui` | `vitest --ui` | Interfaz de Vitest |
| `test:coverage` | `vitest run --coverage` | Una corrida con cobertura |
| `test:e2e` | `playwright test` | Playwright, proyectos `chromium` (dev) y `prod` (build en el puerto 3100) |
| `test:e2e:ui` | `playwright test --ui` | Playwright en modo UI |
| `storybook` | `storybook dev -p 6006` | Storybook en http://localhost:6006 |
| `build-storybook` | `storybook build` | Build estático de Storybook |
| `size` | `node scripts/first-load-js.mjs` | JS de primera carga por ruta contra su presupuesto (`npm run size -- <url>`) |
| `screenshots` | `node scripts/take-screenshots.mjs` | Regenera `screenshots/` contra un build en marcha (`BASE_URL` para otro origen) |

Sin script propio: `npx tsc --noEmit` (tipos) y `npx vitest run` (una corrida).

Detalle de cada suite en [docs/testing.md](./docs/testing.md).

## Ramas y commits

- No trabajes directo sobre `main`. Usa una rama por tema con prefijo de tipo:
  `feat/…`, `fix/…`, `docs/…`, `refactor/…` (por ejemplo `feat/ui-overhaul`,
  `feat/backend`).
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):
  `tipo(ámbito opcional): resumen`. Tipos que usa el repo: `feat`, `fix`,
  `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ci`, `chore`. Ejemplos
  del historial: `fix(wishlist): call it Favoritos everywhere`,
  `perf(images): AVIF, a tighter gallery sizes, hero copy painted once`.
- El resumen describe el cambio en una línea; el cuerpo, si hace falta, explica
  el porqué.
- Un commit, un cambio coherente. No mezcles un refactor con un cambio de
  comportamiento.

## Checklist del PR

- [ ] `npm run lint` sin errores (incluye las guardas del sistema de diseño: nada
      de colores crudos, `dark:` fuera de `ui/`, duraciones numéricas ni
      `text-sm`/`text-2xl` en código de app, ni imports de `@/data` fuera de
      `src/lib/api`).
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npx vitest run` en verde (unit + stories con a11y).
- [ ] `npm run test:e2e` en verde si el cambio toca flujos, rutas o estado.
- [ ] Tests nuevos o actualizados para el comportamiento que cambia. Si tocaste
      una guarda o un token, actualiza `__tests__/lint/guardrails.test.ts` o
      `__tests__/design/tokens.test.ts`.
- [ ] Componentes de UI nuevos: story en claro y oscuro, sin violaciones de axe
      (ver "Cómo agregar un primitivo" en [docs/design-system.md](./docs/design-system.md)).
- [ ] Si el cambio suma JS al cliente, `npm run size` dentro del presupuesto.
- [ ] Cambios visibles: capturas antes/después en claro y oscuro (y en móvil si
      aplica) en la descripción del PR. Si cambian las capturas del README,
      regenéralas con `npm run screenshots`.
- [ ] Docs actualizadas si cambian la arquitectura, los tokens, los scripts o los
      tests, y entrada en [CHANGELOG.md](./CHANGELOG.md) si es un cambio visible.
- [ ] Textos de la UI en español con tuteo ("Revisa", "Completa"), como el resto
      de la app.
