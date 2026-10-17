# LEGO Store

Tienda online de sets LEGO (proyecto de portfolio): catálogo con búsqueda,
filtros en la URL e infinite scroll, ficha de producto, carrito, favoritos,
comparador de hasta 4 productos, páginas de ayuda y un checkout en tres pasos
(pago simulado). Toda la UI está en español, tiene modo oscuro y apunta a WCAG
2.1 AA.

Los datos del catálogo son un mock local. El próximo paso es un backend real
(próximamente, ver
[la spec del backend](./docs/superpowers/specs/2026-10-17-backend-completo-design.md)).
La UI ya está preparada para eso: todas las lecturas pasan por una sola capa,
`src/lib/api`.

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
- **Tailwind CSS 4.3** con tokens de diseño en `src/app/globals.css`
- Primitivos estilo **shadcn/ui** escritos a mano sobre **Base UI 1.9** (`src/components/ui`), con `class-variance-authority` y `tailwind-merge`
- **motion 14** (`motion/react`, vía `LazyMotion` + `m.*`), presets en `src/lib/motion.ts`
- **Zustand 5** (estado del cliente persistido) y **TanStack Query 5** (datos en islas cliente)
- **React Hook Form 7** + **Zod 4** (checkout, contacto, reseñas; se cargan donde se usan), **Sonner 2** (toasts), **lucide-react** (íconos)
- Barlow por `next/font` (self-hosted y precargada)
- **Vitest 5** (unit + Storybook), **Playwright 1.64** (E2E), **Storybook 10** con addon a11y, **ESLint 9**

Requiere Node `^22.13.0` o `>=24`.

## Inicio rápido

```bash
npm ci
npm run dev        # http://localhost:3000
```

Para los tests en navegador (stories y E2E), una vez: `npx playwright install chromium`.

## Scripts principales

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` / `npm start` | Build de producción y servidor |
| `npm run lint` | ESLint (incluye las guardas del sistema de diseño) |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npm test` | Vitest en modo watch (`npx vitest run` para una corrida) |
| `npm run test:coverage` | Cobertura |
| `npm run test:e2e` | Playwright: proyecto `chromium` contra `npm run dev` y proyecto `prod` contra un build en el puerto 3100 |
| `npm run storybook` | Storybook en http://localhost:6006 |
| `npm run size -- <url>` | JS de primera carga por ruta contra su presupuesto, sobre un `npm start` en marcha |
| `npm run screenshots` | Regenera `screenshots/` |

La tabla completa está en [CONTRIBUTING.md](./CONTRIBUTING.md#scripts).

## Documentación

- [Arquitectura](./docs/architecture.md): carpetas, Server vs Client Components,
  flujo de datos, estado, rutas, SEO y caché.
- [Sistema de diseño](./docs/design-system.md): tokens, tipografía, primitivos,
  movimiento, guardas de ESLint y cómo agregar un primitivo.
- [Tests y calidad](./docs/testing.md): Vitest, Playwright, CI, presupuestos de JS
  y Lighthouse.
- [Cómo contribuir](./CONTRIBUTING.md): requisitos, ramas, commits y checklist
  del PR.
- [Changelog](./CHANGELOG.md).
- Diseño y auditoría del overhaul:
  [spec del overhaul de UI](./docs/superpowers/specs/2026-10-17-ui-overhaul-design.md),
  [auditoría de UI](./docs/superpowers/audits/2026-10-17-auditoria-ui.md) y
  [spec del backend](./docs/superpowers/specs/2026-10-17-backend-completo-design.md)
  (próximamente).

## En pocas palabras

- **Datos**: las páginas son Server Components que leen de `@/lib/api`
  (server-only); las islas cliente usan los Route Handlers de `src/app/api` con
  React Query. Importar `@/data` fuera de `src/lib/api` es un error de lint.
- **Estado**: stores de Zustand con selectores y persistencia versionada;
  `StoreHydrator` los carga tras hidratar y un script inline aplica el tema antes
  del primer pintado.
- **Diseño**: tokens semánticos en tres niveles con contraste AA verificado por
  tests, paleta por defecto de Tailwind desactivada y guardas de ESLint contra
  colores crudos, `dark:` sueltos, duraciones numéricas y tamaños de texto fuera
  de la escala.
- **Rendimiento**: inicio, fichas y categorías prerenderizadas; paneles poco
  usados, Sonner y reseñas cargados bajo demanda; imágenes AVIF; presupuesto de
  JS por ruta en CI. Lighthouse CI exige accesibilidad ≥ 0.95, buenas prácticas
  ≥ 0.9 y SEO ≥ 0.9 en las rutas indexables; rendimiento (≥ 0.8) es un aviso.
  La última corrida local dio rendimiento 80–82 (mediana), accesibilidad 100 y
  buenas prácticas 100.

## Licencia

MIT, ver [LICENSE](./LICENSE).
