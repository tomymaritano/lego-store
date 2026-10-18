# Sistema de diseño

Tokens, primitivos, movimiento y las guardas de ESLint que los hacen cumplir.
Las fuentes de verdad son `src/app/globals.css`, `src/components/ui`,
`src/lib/motion.ts` y `eslint.config.mjs`. El porqué de las decisiones está en
[`docs/superpowers/specs/2026-10-17-ui-overhaul-design.md`](./superpowers/specs/2026-10-17-ui-overhaul-design.md).

## Tokens de color: tres niveles

Todo está en `src/app/globals.css`. El modo oscuro va por clase
(`@custom-variant dark (&:where(.dark, .dark *))`, la clase `dark` va en `<html>`).

1. **Primitivos** (paleta cruda): `--yellow-*`, `--red-*`, `--blue-*`, `--stone-*`,
   y algunos sueltos (`--green-*`, `--amber-*`, `--orange-700`, `--purple-700`).
   Son variables CSS comunes, **no** utilidades de Tailwind: ningún componente
   puede usarlos. La paleta por defecto de Tailwind está desactivada
   (`--color-*: initial`), así que `bg-gray-500` o `bg-white` no existen.
2. **Semánticos** (para qué sirve el color): definidos en `:root` y redefinidos en
   `.dark`. Es el único nivel que cambia con el tema.
3. **De componente**: solo donde ningún semántico describe el color (insignias,
   acentos de marca, filas resaltadas).

Los niveles 2 y 3 se exponen como utilidades con `@theme inline`
(`--color-<token>` → `bg-<token>`, `text-<token>`, `border-<token>`…).

### Semánticos

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `bg` | `stone-0` | `stone-950` | Fondo de página |
| `bg-subtle` | `stone-50` | `stone-900` | Fondo de bloques suaves |
| `bg-muted` | `stone-100` | `stone-850` | Hover, secciones alternas |
| `surface` | `stone-0` | `stone-800` | Tarjetas, paneles |
| `surface-raised` | `stone-0` | `stone-750` | Popovers, menús |
| `overlay` | `rgb(23 20 18 / 0.6)` | `rgb(0 0 0 / 0.7)` | Fondo de diálogos y sheets |
| `fg` | `stone-925` | `stone-25` | Texto principal |
| `fg-secondary` | `stone-600` | `stone-300` | Texto secundario |
| `fg-muted` | `stone-550` | `stone-400` | Texto terciario, placeholders |
| `border` | `stone-200` | `stone-700` | Bordes por defecto |
| `border-strong` | `stone-500` | `stone-450` | Bordes de controles (3:1) |
| `primary` / `primary-hover` | `yellow-400` / `yellow-500` | `yellow-400` / `yellow-300` | Amarillo LEGO, acción principal |
| `on-primary` | `stone-925` | `stone-925` | Texto sobre `primary` |
| `danger` / `on-danger` | `red-600` / `stone-0` | `red-300` / `stone-950` | Errores, acciones destructivas |
| `success` / `on-success` | `green-700` / `stone-0` | `green-400` / `green-950` | Confirmaciones |
| `warning` / `on-warning` | `amber-700` / `stone-0` | `amber-400` / `stone-925` | Avisos |
| `info` / `on-info` | `blue-600` / `stone-0` | `blue-300` / `stone-950` | Links, acentos informativos |
| `focus-ring` | `blue-600` | `yellow-400` | Anillo de foco |
| `rating` | `amber-600` | `amber-400` | Estrellas |
| `sale` / `on-sale` | `red-600` / `stone-0` | `red-300` / `stone-950` | Precios en oferta |

### De componente

| Token | Valor | Uso |
| --- | --- | --- |
| `badge-sale`, `badge-new`, `badge-limited`, `badge-exclusive` (+ `on-*`) | `red-600`, `blue-600`, `orange-700`, `purple-700` con texto `stone-0` en ambos temas | Insignias de producto sobre fotos |
| `badge-neutral` | `stone-100` / oscuro `stone-750` | Insignia neutra (texto `fg`) |
| `brand-red` / `on-brand-red` | `red-600` / `stone-0`, fijo | Acentos rojos sobre el hero amarillo y la barra promo |
| `info-surface` / `on-info-surface` | `blue-600` / oscuro `blue-800`, texto `stone-0` | Banda azul sólida (CTA, ladrillo del hero) |
| `row-highlight` | `blue-50` / oscuro `blue-850` | Filas resaltadas en "Resaltar diferencias" del comparador |

## Tipografía, radios, sombras y movimiento

- **Fuente**: Barlow por `next/font` (`--font-barlow` en `<html>`), pesos 400–800,
  `display: "optional"`. `--font-sans` cae a `system-ui`.
- **Escala tipográfica** (`@theme`): `text-caption` (12/16), `text-label` (14/20,
  600), `text-body` (16/24), `text-title` (20/28, 700), `text-heading`
  (fluido 24→30 px), `text-headline` (fluido 30→36 px, h1 de página),
  `text-display` (fluido 36→60 px, 800). Por defecto `h1` usa `text-display`,
  `h2` `text-headline`, `h3` `text-heading` y `h4` `text-title`.
- **Radios**: `rounded-sm` (0.25rem), `md` (0.375rem), `lg` (0.5rem), `xl` (1rem),
  `2xl` (1.5rem).
- **Sombras** (cambian con el tema vía `--elevation-*` y `--shadow-color`):
  `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-card`.
- **Duraciones**: `--duration-fast` 150 ms, `--duration-base` 200 ms,
  `--duration-slow` 300 ms, como utilidades `duration-fast`, `duration-base`,
  `duration-slow`.
- **Curvas**: `ease-standard`, `ease-emphasized`, `ease-exit`.
- **Animaciones CSS**: `animate-shimmer` (Skeleton) y `animate-brick-drop` (404).
- **Otros**: `--spacing-header` (4rem, alto del header y `scroll-padding-top`),
  utilidades `container-custom`, `scrollbar-hide`, y clases `photo-blend`,
  `photo-opaque`, `scroll-fade-y`, `disclosure`.

## Contraste

Política: AA para todo texto (4.5:1) y 3:1 para UI no textual (anillo de foco,
`border-strong`, estrellas), en claro **y** oscuro.

La hace cumplir `__tests__/design/tokens.test.ts`, que parsea `globals.css` y
verifica:

- `fg`, `fg-secondary` y `fg-muted` sobre `bg`, `bg-subtle`, `bg-muted`, `surface`
  y `surface-raised`;
- cada `on-*` sobre su relleno (`primary`, `primary-hover`, `danger`, `success`,
  `warning`, `info`, `sale`, insignias, `brand-red`, `info-surface`) y los colores
  de estado como texto sobre `bg`, `bg-subtle` y `surface`;
- 3:1 para `focus-ring`, `border-strong`, `rating` y `brand-red` sobre `primary`;
- que `row-highlight` se distinga de `surface` y mantenga el texto en AA;
- que `.dark` solo redefina semánticos/elevación (nunca primitivos) y que los
  semánticos apunten a primitivos con `var()`;
- que `--duration-*` coincida con `duration` de `src/lib/motion.ts`;
- que cada utilidad `--color-*` tenga algún uso en `src/` o `.storybook/`.

Si agregas o cambias un token de color, agrega su par a `pairs` en ese test.

## Primitivos (`src/components/ui`)

Escritos a mano en estilo shadcn/ui sobre [Base UI](https://base-ui.com)
(`@base-ui/react`), con `cva` para variantes y `cn` (`clsx` + `tailwind-merge`,
en `src/lib/utils.ts`). El barrel `src/components/ui/index.ts` es la API pública.

| Componente | Para qué | Props / variantes clave |
| --- | --- | --- |
| `Button` (`buttonVariants`) | Botón base (Base UI) | `variant`: `primary`, `secondary`, `outline`, `ghost`, `destructive`, `link`; `size`: `sm`, `md`, `lg`, `icon`, `icon-sm`; `loading`; `render={<Link …/>}` para links |
| `IconButton` | Botón solo ícono con nombre accesible obligatorio | `label` (requerido), `variant` (por defecto `ghost`), `size` `icon` / `icon-sm` |
| `Spinner` | Indicador de carga decorativo (`aria-hidden`) | props de `<svg>` |
| `Input`, `Textarea` | Campos de texto | `invalid`, `leftIcon`, `rightIcon` (Input); leen el cableado de `Field` |
| `Field` (`useFieldControl`) | Label + control + ayuda + error con `for`, `aria-describedby`, `aria-invalid` | `label`, `hint`, `error`, `required`, `disabled`, `hideLabel`, `id` |
| `Select` (`SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) | Select de Base UI | partes componibles |
| `Checkbox` | Checkbox de Base UI | `label`, `description` |
| `RadioGroup`, `RadioGroupItem` | Grupo de radios de Base UI | se nombra con `aria-labelledby` desde `Field` |
| `Slider` | Slider simple o de rango | `thumbLabels`, `formatValueText` |
| `Dialog` (`DialogTrigger`, `DialogClose`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`) | Modal centrado | `showCloseButton`, `closeLabel` en `DialogContent` |
| `Sheet` (`SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetBody`, `SheetFooter`, `SheetTitle`, `SheetDescription`) | Panel lateral (Dialog de Base UI) | `side`: `right`, `left`, `top`, `bottom`; `showCloseButton`, `closeLabel` |
| `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`) | Pestañas de Base UI | partes componibles |
| `Card` (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `cardVariants`) | Contenedor con borde | `elevation`: `flat`, `raised`; `interactive` (elevación al pasar el puntero, solo CSS) |
| `Badge` (`badgeVariants`) | Insignia | `variant`: `neutral`, `new`, `sale`, `limited`, `exclusive`, `success`, `warning`, `danger` |
| `Rating` | Estrellas de solo lectura (una imagen con texto alternativo) | `value`, `count`, `showValue`, `size`: `sm`, `md`, `lg` |
| `RatingInput` | Calificación editable sobre radios nativos | `label`, `value`, `onValueChange`, `error`, `hideLabel`, `inputRef`, `size` |
| `Price` | Precio actual, original tachado y descuento | `value`, `originalValue`, `showDiscount`, `size`: `sm`, `md`, `lg` |
| `EmptyState` | Estado vacío con ícono, título y acción | `icon`, `title`, `description`, `action`, `headingLevel` |
| `Skeleton`, `ProductCardSkeleton`, `ProductListSkeleton` | Placeholders de carga con shimmer | `count`, `columns` (3 o 4) en la lista |
| `QuantitySelector` | Stepper − valor + | `value`, `onValueChange`, `min`, `max`, `size`: `sm`, `md`, `label` |
| `Toaster`, `showToast`, `toast` | Toasts con Sonner cargado bajo demanda | `showToast.success`, `error`, `warning`, `info`, `cart`, `undo`, `wishlist`; `toast.dismiss` |
| `Breadcrumbs` | Migas de pan desde "Inicio" | `items: { label, href? }[]` (el último es la página actual) |
| `ThemeToggle` | Ciclo claro / oscuro / sistema | `showLabel` |
| `Table` (`TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) | Tabla de datos con HTML semántico (las del admin); en pantallas angostas se desplaza dentro de su marco, una región enfocable y con nombre | `label` (nombre de la región, obligatorio), `containerClassName` |

`ToastViewport.tsx` es interno (lo carga `Toaster`) y no se exporta.

Cada primitivo del barrel tiene su `*.stories.tsx` con al menos una story en
oscuro (`globals: { theme: "dark" }`). Tienen tests de componente en
`__tests__/components/ui`: `Button`, `Dialog`, `Field`, `QuantitySelector` y
`Rating`.

### Por qué no `shadcn add`

Los primitivos se escriben a mano, en estilo shadcn, y el repo no tiene
`components.json` a propósito. No uses `npx shadcn add`: el CLI reescribe
`globals.css` con sus propios tokens (`bg-popover`, `text-muted-foreground`,
`ring-ring`…, que acá no existen) y genera archivos en kebab-case (`button.tsx`)
que chocan con los PascalCase en sistemas de archivos que no distinguen
mayúsculas (Windows, macOS). Para traer uno, cópialo de la documentación de
shadcn para Base UI y re-tokenízalo (ver la checklist de abajo).

## Movimiento

Presets en `src/lib/motion.ts`, todos entre 150 y 300 ms:

- `duration` (`fast` 0.15, `base` 0.2, `slow` 0.3 s) y `ease` (`standard`,
  `emphasized`, `exit`), espejo de los tokens CSS.
- `transitions`: `fast`, `base`, `slow`, `exit`, `spring`.
- Variants (etiquetas siempre `hidden` / `visible` / `exit`): `fadeIn`, `fadeInUp`,
  `scaleIn`, `stepSlide` (checkout), `successPop` y `drawPath` (confirmación),
  `gallerySlide`, `dismissible` (filas del carrito), `collapse`, `labelSwap`,
  `dropDown`, `slideUp` (barra del comparador), `staggerItem`, `gridItem`, `riseIn`
  (solo mueve, nunca oculta: para contenido sobre el pliegue y el LCP),
  `pageTransition`.
- Stagger: `STAGGER` (0.04 s), `STAGGER_DELAY` (`short`, `step`),
  `staggerDelay(index)` (con tope de 0.24 s) y `staggerContainer()`.
- `hoverLift` para contenedores (solo hover).

Uso:

- Los componentes renderizan `m.*` (no `motion.*`) dentro de
  `<LazyMotion features={…} strict>` de `ClientProviders`; las features (`domMax`)
  llegan desde `src/lib/motion-features.ts`. `strict` hace que un `motion.*`
  suelto falle en desarrollo.
- Desde un Server Component usa `Stagger`, `StaggerItem` (`effect`: `rise`, `pop`,
  `lift`) o `Reveal` de `src/components/motion/Reveal.tsx`.
- `Sheet` y `Dialog` animan con CSS (`data-starting-style` / `data-ending-style`),
  no con motion.

**Movimiento reducido:**

- `<MotionConfig reducedMotion="user">` en `ClientProviders` (y en el preview de
  Storybook): con `prefers-reduced-motion` se saltean las animaciones de
  transformación y queda el fundido de opacidad.
- `globals.css` lleva duraciones de animación y transición a 0.01 ms, anula los
  retrasos y desactiva el scroll suave bajo `prefers-reduced-motion: reduce`.
- Las transformaciones de hover en CSS se anulan con `motion-reduce:` (por ejemplo
  `Button` y `Card interactive`).

## Guardas de ESLint

En `eslint.config.mjs`, como `no-restricted-syntax` (errores). Revisan class names
dentro de cualquier string o template literal. Cada patrón tiene casos en
`__tests__/lint/guardrails.test.ts`: si tocas un patrón, agrega el caso.

| Guarda | Prohíbe | Alcance |
| --- | --- | --- |
| Paleta cruda | `bg-gray-500`, `text-blue-600`… (cualquier color de Tailwind con número) | todo `src/` |
| Blanco/negro | `text-white`, `bg-black/50`, `shadow-black`, `ring-offset-white`… | todo `src/` |
| Colores arbitrarios | `bg-[#f00]`, `bg-[rgb(…)]`, `text-[color:#f00]`, `bg-[oklch(…)]`, `bg-[red]`, `border-[color:navy]` (palabras clave como `transparent` o `currentColor` se permiten) | todo `src/` |
| Colores en `style` y SVG | hex/`rgb()`/`hsl()`/`oklch()` en `style={{…}}` y en `fill`, `stroke`, `stopColor`, `floodColor`, `lightingColor`, `color` | todo `src/` |
| Alias heredados | `lego-*`, `brand-<n>`, `background-*`, `foreground-*`, `status-*`, `border-subtle` | todo `src/` |
| `dark:` | cualquier variante `dark:` (también `md:dark:`, `hover:dark:`) | `src/` salvo `src/components/ui` |
| Duraciones de motion | `duration: <número>` en props de motion (`transition`, `animate`, `initial`, `exit`, `while*`, `variants`), en objetos `transition` y en variables `*transition` / `*variants` o tipadas `Variants` / `Transition` | todo `src/` |
| Tiempos de Tailwind | `duration-300`, `ease-in`, `ease-out`, `ease-in-out`, `ease-linear` | todo `src/` |
| `transform` en transiciones | `transition-[…transform…]` (en Tailwind 4 `scale`, `rotate` y `translate` son propiedades propias) | todo `src/` |
| Tamaños de texto | `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl` … `text-9xl` | `src/` salvo `src/components/ui` |
| Import de `src/data` | `@/data`, `@/data/*`, `**/data/products`, `**/data/categories` (`no-restricted-imports`): es solo la fuente del seed, la app lee de la base vía `@/lib/api` | `src/` salvo `src/data/**` |
| zod en el bundle del layout | `zod`, `zod/*` y `@/lib/validations/*` (salvo `@/lib/validations/newsletter`) sin `import type` (~30 kB gzip en la primera carga de todas las rutas) | `src/components/layout`, `src/stores`, `src/providers`, `src/lib/lists/pending-merge.ts` y `sync-plan.ts` |

Dentro de `src/components/ui` rigen las de color, alias, motion y `transform`;
`dark:` y los tamaños compactos de los primitivos (por ejemplo los de `Button`)
están permitidos ahí.

## Cómo agregar un primitivo

1. Créalo en `src/components/ui/<Nombre>.tsx` (PascalCase). Si tiene interacción,
   constrúyelo sobre la pieza de Base UI correspondiente (`@base-ui/react/<pieza>`)
   y marca el archivo con `"use client"`; si no, déjalo como Server Component.
2. Variantes con `cva` y `VariantProps`; une clases con `cn` de `@/lib/utils`.
   Acepta `className` y pásalo último a `cn`. Agrega `data-slot="<nombre>"`.
3. Solo tokens: `bg-surface`, `bg-surface-raised`, `text-fg`, `text-fg-muted`,
   `border-border-strong`, `ring-focus-ring`, `bg-bg-muted`… Nada de colores
   crudos (las guardas lo marcan). Si de verdad falta un color, agrega un token
   semántico o de componente en `globals.css` (claro y oscuro) y su par en
   `tokens.test.ts`.
4. Tiempos con `duration-fast|base|slow` y `ease-standard|emphasized|exit`, o los
   presets de `@/lib/motion`. Hover con transformación: agrega su `motion-reduce:`.
5. Accesibilidad: nombre accesible obligatorio (como `label` en `IconButton`),
   foco visible (`focus-visible:ring-2 focus-visible:ring-focus-ring`), teclado
   completo; si es un control de formulario, conéctalo a `Field` con
   `useFieldControl`.
6. Expórtalo (con sus tipos) desde `src/components/ui/index.ts`.
7. Escribe `<Nombre>.stories.tsx` con una story en claro y otra en oscuro
   (`globals: { theme: "dark" }`). El addon a11y corre con `test: "error"`
   (`.storybook/preview.tsx`): cualquier violación de axe hace fallar
   `npx vitest run --project storybook`.
8. Si tiene lógica (estado, teclado, ARIA), agrega un test en
   `__tests__/components/ui/<Nombre>.test.tsx`.
9. Corre `npm run lint`, `npx tsc --noEmit` y `npx vitest run`.
