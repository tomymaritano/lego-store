# Overhaul de UI, sistema de diseño y framework — Diseño

Fecha: 2026-10-17. Base: `docs/superpowers/audits/2026-10-17-auditoria-ui.md`.

## Intención
Dejar la UI "perfecta" antes de construir el backend
(`2026-10-17-backend-completo-design.md`): framework y librerías al día, un sistema de
diseño real (tokens + primitivos), componentes sin deuda técnica, accesibilidad sólida y
animaciones mejores y consistentes. La tienda tiene que verse y sentirse igual o mejor —
misma identidad LEGO (amarillo/rojo/azul), dark mode, español.

## Objetivos
1. **Framework**: Next 16 + React 19, Tailwind 4, ESLint 9 flat config, `motion`
   (`motion/react`) en vez de `framer-motion`, lucide 1.x, toolchain de tests actualizado.
   Quitar deps sin uso/duplicadas (react-hot-toast, keen-slider, @storybook/nextjs,
   playwright suelto). TypeScript se queda en 5.9, ESLint en 9.
2. **Sistema de diseño**: tokens en CSS vars en tres niveles (primitivos → semánticos →
   componente) expuestos vía `@theme` de Tailwind 4: color (con pares on-color y foco),
   radius, sombras dark-aware, tipografía (caption ≥12px, label, body, title, display),
   motion (duraciones/easing). Contraste WCAG AA en light y dark.
3. **Primitivos**: **shadcn/ui sobre Base UI** en `src/components/ui`, adaptados a los
   tokens: Button (con `render`/asChild para links), IconButton (label obligatorio),
   Input, Textarea, Field (label+hint+error con aria), Select, Checkbox, RadioGroup,
   Slider, Dialog, Drawer/Sheet, Tabs, Card, Badge, Rating, Price, EmptyState, Skeleton,
   QuantitySelector, Toast (sonner), Breadcrumbs. Cada uno con story light/dark.
4. **Arquitectura**: páginas como Server Components que leen vía `src/lib/api` (nunca
   `@/data/*` fuera de ahí, con regla de lint); islas cliente chicas para interacción;
   una sola búsqueda; filtros y orden conectados con URL search params en category y
   search; `useProductActions` para carrito/wishlist/comparar; checkout partido en pasos;
   stores con selectores, sin funciones derivadas, compare/recently-viewed guardan IDs;
   hidratación sin `useHydration` por todos lados; script de tema en `<head>` (sin flash);
   `error.tsx`/`loading.tsx`/`not-found` coherentes y `global-error.tsx`.
5. **Animaciones**: `lib/motion.ts` con transiciones y variantes compartidas,
   `<MotionConfig reducedMotion="user">`, micro-interacciones consistentes (hover/press de
   cards y botones, add-to-cart con feedback, drawer/dialog, stagger de grillas, layout
   animations en carrito/filtros, transiciones de página sutiles). Rápidas (150–300ms),
   nunca bloquean la interacción.
6. **Calidad**: lint + typecheck + unit + E2E + build verdes; tests de componentes para
   formularios, búsqueda y primitivos clave; Storybook con a11y como error; CI en Node 22.

## No-objetivos
- Backend, auth, pagos reales (proyecto siguiente).
- i18n: se elimina (solo español). Inglés, si alguna vez, con `next-intl`.
- Rediseño de identidad visual o de la estructura de páginas.

## Anti-objetivos
- Romper flujos existentes (carrito, wishlist, comparar, búsqueda, checkout mock).
- Animaciones lentas, que tapen contenido o que no respeten reduced-motion.
- Colores crudos (`gray-500`, `#hex`) o `dark:` ad-hoc fuera de `ui/`.
- Datos de tarjeta guardados en stores.

## Decisiones (mías, aprobadas en bloque por Tomy al pedir ejecución)
- shadcn/ui con Base UI; Tailwind 4; `motion`; solo español.
- Node local es 22.18: elegir versiones cuyo `engines` lo soporte; CI en Node 22.
- Trabajo en rama `feat/ui-overhaul`, commits por etapa.
