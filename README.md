# LEGO Store

Tienda online de sets LEGO (proyecto de portfolio): catálogo con búsqueda e
infinite scroll, ficha de producto, carrito, lista de deseos, comparador de
hasta 4 productos y un checkout en pasos (pago simulado). Toda la UI está en
español, tiene modo oscuro y apunta a WCAG 2.1 AA.

El catálogo vive en PostgreSQL (Prisma) y todas las lecturas pasan por una sola
capa (`src/lib/api`). Hay cuentas de usuario (registro, login, perfil, roles
cliente/admin) con Auth.js. El resto del backend (carrito y favoritos en el
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
- **Auth.js** (`next-auth@5.0.0-beta.32`, compatible con Next 16 y React 19): email + contraseña (bcrypt) y Google opcional, sesiones JWT
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
    (auth)/            /login y /register + sus Server Actions (login, registro)
    account/           /account: perfil, contraseña, sesión (+ Server Actions)
    admin/             /admin: resumen de la tienda (solo ADMIN)
    forbidden.tsx      Página 403 (forbidden())
    api/               Route Handlers para las islas cliente
      products/        GET /api/products (filtros, orden, paginación)
      products/by-ids/ GET /api/products/by-ids?ids=1,2
      products/facets/ GET /api/products/facets (conteos en vivo de los filtros)
      search/          GET /api/search?q= (autocompletado)
      auth/[...nextauth]/  Endpoints de Auth.js (OAuth, sesión, CSRF)
    cart/ wishlist/ compare/ search/ category/ item/
    checkout/_components/  Pasos, resumen y confirmación del checkout
  components/
    ui/                Primitivos del sistema de diseño (barrel index.ts)
    layout/            Navbar, Footer, PageHeader, menú de cuenta, menús y paneles (carga diferida)
    auth/ account/     Formularios de login/registro y de /account
    product/           Tarjeta, grilla, catálogo y filtros, ficha, galería, reseñas (reviews/)
    cart/ wishlist/ compare/ search/ home/ info/ forms/ icons/
    motion/            Reveal / Stagger para Server Components
  data/                Fuente del seed (la app no lo lee: ESLint lo impide)
  generated/prisma/    Cliente de Prisma generado (gitignored)
  hooks/               useProductActions, useProductsByIds, useInfiniteScroll…
  lib/
    api/               Gateway de datos (server-only): consultas Prisma + caché de Next
    db/                Cliente de Prisma (instancia única en el servidor)
    auth/              Auth.js (index.ts), sesión y permisos (session.ts: getCurrentUser,
                       requireUser, requireAdmin, authorizeRequest), cuentas (accounts.ts),
                       adapter de Prisma, callbackUrl seguro, hash de contraseñas (bcrypt),
                       actions.ts (logout y Google, que usan el navbar y /account)
    rate-limit/        Rate limiting en Postgres (login, registro; reutilizable)
    admin/             Datos del panel de admin (verifican el rol ellos mismos)
    api-client.ts      Llamadas del navegador a /api/*
    productQuery.ts    ProductQuery <-> URL search params
    pricing.ts         Subtotal, envío y totales (carrito y checkout)
    card.ts argentina.ts  Tarjetas, provincias y códigos postales
    flyToCart.ts       Animación "vuela al carrito" (Web Animations API)
    motion.ts motion-features.ts theme.ts metadata.ts utils.ts validations/
  stores/              Zustand: cart, wishlist, compare, recentlyViewed, theme, reviews, checkout, ui
  types/               Tipos de dominio (única fuente)
src/proxy.ts           /account y /admin sin sesión van a /login; 404 reales de /item y /category
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
  se renderizan por pedido (el navbar depende de la sesión, ver
  [Cuentas y sesiones](#cuentas-y-sesiones)), pero sus lecturas del catálogo salen
  de esa caché hasta que una escritura llama a `invalidateCatalog()`
  (`src/lib/api/cache.ts`, vencimiento inmediato) o, desde una Server Action cuyo
  usuario tiene que ver su cambio al instante (una reseña), a `updateCatalog()`
  (`updateTag`: Next re-renderiza la página actual en la misma respuesta). Hay además una revalidación por tiempo de 1 h como red de
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

## Cuentas y sesiones

- **Auth.js v5** (`src/lib/auth/index.ts`): email + contraseña (Credentials, hash
  bcrypt) y Google solo si están `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` (si no,
  el botón no aparece). Páginas propias: `/login`, `/register`, `/account`
  (nombre, contraseña, cerrar sesión) y `/admin`.
- **Sesiones JWT** en una cookie HttpOnly, no sesiones en base: Credentials solo
  admite JWT y leer la sesión no cuesta una consulta (el navbar la lee en cada
  página). Lo que un JWT no tiene, revocación inmediata, se cubre en el servidor:
  el token lleva la `sessionVersion` del usuario y `getCurrentUser()` la compara
  con la base en cada página, acción y ruta protegida. Cambiar la contraseña la
  incrementa, así que se cierran las sesiones de los otros dispositivos. Un token
  viejo no puede revivir pidiendo un refresh (`POST /api/auth/session` está abierto
  a cualquier cliente): el refresh solo copia nombre, email y rol de la base, y pasar
  a la versión nueva exige una renovación firmada con `AUTH_SECRET` que arma la
  acción de cambio de contraseña para su propia sesión (`session-token.ts`). El rol
  también sale siempre de la base, nunca del token.
- **Cerrar sesión** borra la cookie de ese navegador y nada más: los otros
  dispositivos siguen con su sesión (lo esperable al cerrar sesión en el celular,
  por ejemplo). Una copia del token tomada antes (cookie filtrada, compu
  compartida) sigue valiendo hasta que vence (30 días desde el ingreso) o hasta
  que se cambia la contraseña, que sí cierra todas las sesiones. Cerrar todas al
  salir sería incrementar `sessionVersion` en `logoutAction` (`src/lib/auth/actions.ts`).
- **La sesión no se renueva sola**: `proxy.ts` decide con la cookie pero no escribe
  cookies (el wrapper de Auth.js re-emite la cookie en cada pedido, y un prefetch
  de `/account` que respondiera después del logout la volvía a escribir y deshacía
  el logout). Por eso el token dura 30 días desde el ingreso o desde la última
  renovación del servidor (cambio de nombre o de contraseña), no 30 días desde la
  última visita. Los links a `/account` y `/admin` de los menús tampoco hacen prefetch.
- **Roles** USER / ADMIN: el email de `ADMIN_EMAIL` recibe ADMIN en el seed y al
  entrar por primera vez con Google (solo con el email verificado por Google). El
  formulario de registro **no** acepta `ADMIN_EMAIL` (responde como si ya existiera
  la cuenta): como no hay verificación de email, quien se registrara primero con esa
  dirección en una base nueva sería admin. Esto se aparta del spec («recibe ADMIN…
  al registrarse»); la cuenta admin sale solo del seed (o de Google con email
  verificado). El servidor deja un aviso en el log cuando rechaza ese registro. Los emails se guardan siempre en minúsculas (`CHECK` en la
  base); `normalizeEmail()` corre antes de cada escritura y búsqueda, incluido el
  adapter de OAuth.
- **Protección en dos capas**: `src/proxy.ts` manda a `/login?callbackUrl=…` a quien
  pide `/account/*` o `/admin/*` sin sesión (chequeo optimista: solo mira la cookie).
  La autorización real está en el servidor: cada página, Server Action y Route
  Handler protegida llama a `requireUser()`, `requireAdmin()` (403 con
  `forbidden()`, `experimental.authInterrupts`) o `authorizeRequest()` (401/403 en
  JSON para Route Handlers). Las funciones de datos de admin verifican el rol ellas
  mismas.
- **callbackUrl**: solo rutas del mismo sitio (`safeCallbackUrl`): otro origen,
  `//host`, `/\host`, caracteres de control, `/login`, `/register` y `/api/*` vuelven
  al inicio. Se revisa también el resultado ya normalizado, porque `/.//host` o
  `/a/..//host` se convierten en `//host` al resolver los segmentos con punto.
- **Rate limiting** (`src/lib/rate-limit`): ventana fija con el contador en Postgres
  (tabla `RateLimit`, un `INSERT … ON CONFLICT` atómico con el reloj de la base), así
  que vale entre instancias y en serverless. Login, en orden y cortando en el primer
  rechazo (un intento rechazado no suma en los límites siguientes): 5 intentos por
  cuenta y origen cada 15 min (un login correcto los borra), 50 por IP cada 15 min y
  30 por cuenta por hora desde cualquier IP. El origen es la IP, o el dispositivo si
  el navegador ya ingresó antes a esa cuenta: una cookie HttpOnly firmada con
  `AUTH_SECRET` (`known-device.ts`). Los dispositivos conocidos solo pasan por su
  propio límite de 5, así que quien adivina contraseñas llena los contadores
  compartidos pero no deja afuera al dueño en los navegadores que ya usa (un
  dispositivo nuevo del dueño sí puede esperar hasta una hora si alguien llenó el
  límite por cuenta desde muchas IPs). Registro: 20 cuentas por IP por hora;
  contraseña actual en `/account`: 5 cada 15 min; reseñas nuevas: 10 por usuario por
  hora; votos "útil": 60 por usuario cada 15 min. Para limitar algo nuevo (contacto,
  newsletter) se agrega una entrada en `rateLimits` y se llama `consume(sujeto)`. `memoryStore()` existe para tests: no se comparte entre
  instancias.
- **La IP del cliente** (`clientIp()`) solo sale de headers que pone
  infraestructura de confianza, porque `X-Forwarded-For` lo puede mandar cualquiera
  (`next dev` y `next start` lo dejan pasar tal cual): en Vercel, los headers que su
  edge reescribe; detrás de tus proxies, `TRUSTED_PROXY_HOPS=N` toma la entrada de
  `X-Forwarded-For` que agregó el proxy más externo (N desde la derecha). Sin ninguna
  de las dos (desarrollo, un `next start` expuesto directo) no se confía en ninguna
  IP: todos los clientes comparten el bucket `unknown`, así que los límites por IP
  valen para todo el sitio junto (estricto, pero puede frenar a gente legítima: un
  self-host público tiene que estar detrás de un proxy que reescriba
  `X-Forwarded-For` y definir `TRUSTED_PROXY_HOPS`). Los límites por cuenta y los
  dispositivos conocidos no dependen de la IP.
- **Navbar sin parpadeo**: el layout raíz lee la sesión (`getCurrentUser()`) y el
  navbar llega del servidor ya con el menú de cuenta o el link de ingreso. El costo:
  todas las páginas se renderizan por pedido en vez de prerenderizarse (ver
  [Rendimiento](#rendimiento)).
- **Configuración**: `AUTH_SECRET` es obligatoria. Sin ella Auth.js falla cerrado:
  todas las páginas se ven sin sesión, nadie puede ingresar y `/login` y `/register`
  avisan que falta. Fuera de Vercel, `next start` necesita `AUTH_TRUST_HOST=true`
  (o `AUTH_URL`) para que Auth.js acepte el host.

## Carrito, favoritos y reseñas

- **Visitantes**: carrito y favoritos viven en localStorage, como siempre. Al cargar
  la página, las líneas del carrito toman precio y stock actuales del catálogo
  (`/api/products/by-ids`); las de productos borrados o agotados se quitan.
- **Con sesión** el servidor es la verdad (`CartItem`, `WishlistItem`). Los stores de
  Zustand siguen siendo la capa de UI y guardan de quién es la copia (`owner`).
  `<ListsSync />` (`src/components/layout/ListsSync.tsx`, reglas en
  `src/lib/lists/sync-plan.ts`):
  - al **ingresar**, el carrito y los favoritos del visitante se fusionan con los de
    la cuenta (`mergeListsAction`): cantidades sumadas y topeadas por el stock,
    favoritos unidos, productos inexistentes o agotados descartados. Pasa una sola
    vez: después la copia es de la cuenta y no se vuelve a sumar;
  - en cada carga y al volver a la pestaña recarga las listas de la cuenta
    (`GET /api/lists`, sin caché): precios, nombres y stock actuales, nunca un
    snapshot. Una recarga que se cruzó con un cambio en curso se descarta;
  - al **cerrar sesión** (o si la sesión vence) borra la copia de la cuenta de ese
    navegador. La copia de otra cuenta nunca se fusiona.
- **Cambios optimistas** (`src/stores/listsRemote.ts`): el store cambia al instante y
  manda la Server Action (`src/lib/lists/actions.ts`: zod, sesión propia, solo ids y
  cantidades). La respuesta trae la línea como la tiene el servidor (cantidad
  topeada por stock, precio actual) y reemplaza la local; si el servidor la rechaza
  o no responde, la línea vuelve a como estaba y un toast lo explica. Si llegan
  respuestas viejas después de un cambio más nuevo de la misma línea, se ignoran.
- **Stock**: toda escritura topea la cantidad con el stock en la misma transacción
  (los incrementos son atómicos en SQL, dos pestañas no se pisan). Una línea cuyo
  producto se agotó queda guardada pero no se lista ni llega al checkout; vuelve si
  hay reposición.
- **Reseñas** (`src/lib/reviews`): crear exige sesión y es una por usuario y producto
  (clave única); se pueden editar y borrar (las propias; un admin borra cualquiera).
  El nombre publicado es el de la cuenta. Cada escritura recalcula `Product.rating` y
  `reviewCount` en la misma transacción y después llama a `updateCatalog()`, así que
  la página del producto (rating, cantidad, lista) se actualiza en la misma respuesta
  y los listados en el próximo pedido. "Útil" es un voto por usuario que se puede
  retirar (no sobre la reseña propia). **Compra verificada** = el autor tiene un
  pedido de su cuenta en PAID, SHIPPED o DELIVERED con ese producto (los pedidos de
  invitado no cuentan).
- **Lista de reseñas**: orden (recientes, útiles, mejor y peor valoradas) y páginas de
  5 en el servidor (`GET /api/products/<id>/reviews?sort=&page=`, en el data cache
  bajo los tags del producto); el resumen (promedio e histograma) es sobre todas.
  Lo del usuario (su reseña y sus votos) sale de
  `GET /api/products/<id>/reviews/mine`, sin caché.

## Estado del cliente

- Stores de Zustand con **selectores** (`useCartCount`, `useCartSubtotal`,
  `useIsInCart(id)`, `useIsInWishlist(id)`, `useCompareIds`…).
- Persistencia versionada con `migrate` desde formatos anteriores. Comparar y
  vistos recientemente guardan IDs; favoritos, un snapshot mínimo. Carrito y
  favoritos guardan además `owner` (ver [Carrito, favoritos y reseñas](#carrito-favoritos-y-reseñas)).
  Las reseñas ya no viven en el navegador: el store viejo (`lego-reviews-storage`)
  se borra al cargar.
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
cp .env.example .env.local  # los valores por defecto ya apuntan al Postgres de Docker;
                            # completá AUTH_SECRET (obligatoria): npx auth secret
npm run db:up               # Postgres 17 en localhost:5433, bases lego_store y lego_store_test
npm run db:migrate          # aplica las migraciones a lego_store
npm run db:seed             # catálogo, reseñas de ejemplo y el admin (ver "Admin")
npm run dev
```

- **Puerto**: Docker publica Postgres en el **5433**, solo en `127.0.0.1` (nadie
  de tu red llega a la base con las credenciales de ejemplo), para no chocar con un
  Postgres instalado en el 5432. Para otro puerto: `POSTGRES_PORT=5434 npm run db:up` y
  ajustá las URLs de `.env.local`.
- **Admin**: el seed crea el admin de `ADMIN_EMAIL` / `ADMIN_PASSWORD` (van juntas:
  si definís solo una, falla). Sin ellas no crea ninguno, salvo que actives el
  **admin de desarrollo** descomentando `SEED_DEV_ADMIN=1` en `.env.local`:
  `admin@lego-store.local` / `admin-dev-1234`, contraseña pública, solo para tu
  máquina. Con `NODE_ENV=production` nunca se crea, y cuando el seed escribe otro
  admin (o ninguno) le quita el rol y la contraseña si existía. Volver a sembrar
  actualiza la contraseña si cambió.
- **El seed es idempotente**: se puede correr las veces que haga falta. Vuelve las
  categorías y los productos del seed a sus valores (stock incluido), crea o
  actualiza los usuarios de ejemplo (sin contraseña: no se puede entrar con ellos),
  sus reseñas, votos "útil" y pedidos entregados (los que hacen "compra
  verificada"), y recalcula los ratings. Lo que crearon personas (registros,
  reseñas, pedidos) no se toca.
- **Tests de integración**: `npx vitest run` incluye el proyecto `integration`, que
  usa `DATABASE_URL_TEST` (su nombre tiene que contener "test"): aplica las
  migraciones pendientes al empezar y cada archivo vacía y vuelve a sembrar las
  tablas que usa. Los archivos corren uno tras otro, y cada corrida toma un lock
  de la base de test: una segunda corrida a la vez (por ejemplo con `npm test` en
  modo watch abierto) falla enseguida diciendo que la base está ocupada. Sin la
  base levantada, la corrida falla con un mensaje que lo explica.
- **El build necesita la base** (lee las categorías y los ids de las rutas). En CI
  hay un servicio Postgres que se migra y siembra antes del build, los tests y los
  E2E.
- **Cambiar el modelo**: editá `prisma/schema.prisma` y corré
  `npm run db:migrate -- --name <cambio>` y `npm run db:generate`. Las restricciones
  CHECK (stock ≥ 0, cantidades > 0, rating 1..5, totales que cierran, emails en
  minúsculas…) están escritas a mano al final de cada migración: si una migración
  nueva recrea una tabla, copiá las suyas.
- **Producción** (Vercel + Neon u otro Postgres): `DATABASE_URL` y `AUTH_SECRET` en
  las variables del proyecto y `npm run db:deploy` + `npm run db:seed` contra esa
  base antes del primer deploy.

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

- Las páginas se renderizan en el servidor por pedido, sin `loading.tsx`: el HTML
  trae el contenido en orden y el texto del hero (el LCP) se pinta en el primer
  frame. Antes de las cuentas, inicio, fichas y categorías se prerenderizaban en el
  build; desde que el navbar muestra la sesión sin parpadeo, el layout lee una
  cookie y Next renderiza cada ruta por pedido. Las lecturas del catálogo siguen
  saliendo del data cache, así que el costo por pedido es el render más una
  consulta de usuario cuando hay sesión. Volver a servir HTML estático pediría
  Cache Components (PPR: shell estático y el menú de cuenta como hueco dinámico),
  un cambio de modelo de caché que queda pendiente. Los filtros de una categoría
  viven en la URL y se aplican en el cliente.
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
  escrituras, Route Handlers y proxy (incluidas las rutas protegidas), seed
  (contenido, idempotencia, admin), las restricciones del schema, cuentas
  (registro, credenciales, roles, contraseña, adapter de OAuth), las Server
  Actions de login y registro, los helpers de sesión y permisos, el rate limiter
  en Postgres (concurrencia y ventanas), carrito y favoritos por usuario (fusión al
  ingresar, topes de stock, datos frescos, cada usuario solo toca lo suyo) y
  reseñas (una por usuario, compra verificada, rating recalculado en la misma
  transacción, "útil" una vez, dueño, rate limit, invalidación, orden y páginas).
- `__tests__/lib`: parser de queries, búsqueda normalizada, caché del catálogo
  (tags e invalidación), validación de cuentas, callbackUrl, roles, rate limiter y
  utilidades.
- `__tests__/stores`: stores, selectores, migraciones e hidratación; la capa
  optimista contra el servidor (rollback, respuestas viejas, recargas que se
  cruzan con un cambio) y las reglas de sincronización al ingresar y salir.
- `__tests__/components`: primitivos (`ui/`), carrito lateral, carrito /
  favoritos / comparador, catálogo y filtros, checkout, formularios, galería,
  ficha de producto, reseñas, autocompletado, formularios y menú de cuenta,
  useProductActions,
  useProductsByIds y suscripciones a los stores.
- `__tests__/config`: cada link de navegación resuelve a una página.
- `__tests__/lint` y `__tests__/design`: guardas de ESLint y contraste de tokens.
- Storybook: cada story se renderiza en Chromium con axe (a11y como error).
- `e2e/`: un archivo por área: `homepage` (inicio), `catalog` (filtros en la URL,
  orden, precio), `search` (búsqueda y combobox), `product` (ficha), `cart`
  (agregar desde tarjetas, carrito lateral, aviso del navbar), `lists`
  (favoritos, comparador y su barra), `checkout` (con axe), `shell` (navbar,
  footer, páginas de información, 404), `state` (estado persistido), `a11y`
  (axe WCAG 2.1 AA en cada página, en modo claro y oscuro), `auth` (registro →
  logout → login → cuenta, redirección de rutas protegidas, callbackUrl, 403 de
  admin, cambio de contraseña, menú móvil, axe), `account-lists` (carrito y
  favoritos de visitante → cuenta, otro navegador, logout), `reviews` (login para
  opinar, publicar / editar / borrar, "útil", orden y páginas, axe) y el proyecto `prod` (navegación,
  transiciones y códigos de estado sobre el build de producción). Los E2E de
  cuentas usan emails `@e2e.lego-store.test`: el setup global los borra de la base
  de dev, limpia los contadores de rate limiting y crea un admin con una contraseña
  aleatoria; el teardown vuelve a borrarlos (y recalcula los ratings, porque sus
  reseñas se van en cascada). Los specs de reseñas comparan la página con la base y
  no con lo que mostraba antes: una corrida que falló a mitad puede dejar el data
  cache del servidor de dev un paso atrás hasta 1 h.

CI (`.github/workflows/ci.yml`): lint, tipos, tests con cobertura, build de
Storybook, build, E2E, auditoría de dependencias de producción, presupuesto de
JS y Lighthouse. Los jobs que necesitan datos levantan un servicio Postgres 17,
corren `prisma migrate deploy` y el seed antes de empezar.

## Licencia

MIT, ver [LICENSE](./LICENSE).
