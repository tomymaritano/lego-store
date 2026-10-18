# LEGO Store

Tienda online de sets LEGO (proyecto de portfolio): catálogo con búsqueda e
infinite scroll, ficha de producto, carrito, lista de deseos, comparador de
hasta 4 productos y un checkout en pasos con Stripe. Toda la UI está en
español, tiene modo oscuro y apunta a WCAG 2.1 AA.

El catálogo vive en PostgreSQL (Prisma) y todas las lecturas pasan por una sola
capa (`src/lib/api`). Hay cuentas de usuario (registro, login, perfil, roles
cliente/admin) con Auth.js, carrito y favoritos por cuenta, reseñas, y pedidos
pagados con Stripe (modo test) con email de confirmación (Resend) y "Mis
pedidos", y un panel de admin (productos, stock, pedidos con envío, entrega y
cancelación con reembolso, moderación de reseñas). El diseño está en
`docs/superpowers/specs/2026-10-17-backend-completo-design.md`. La app
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
- **Stripe** (`stripe` 23 en el servidor, Payment Element con `@stripe/react-stripe-js` 7 y ConfirmationTokens) y **Resend** (emails; sin claves se loguean a consola)
- **React Hook Form** + **Zod** (checkout, contacto y reseñas; se cargan solo donde se usan), **sonner** (toasts)
- Barlow servida por `next/font` (self-hosted y precargada)
- **Vitest** (unit + Storybook), **Playwright** (E2E), **Storybook 10** con a11y

Requiere Node `^22.13` o `>=24`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 (necesita la base, ver abajo) |
| `npm run build` / `npm start` | Build de producción y servidor (el build lee la base: la lista de categorías y los ids de las rutas; las páginas se renderizan por pedido) |
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
| `npm run test:e2e:stripe` | Checkout contra Stripe en modo test real (Payment Element, 3D Secure, webhook); se saltea sin claves de test (ver «Checkout, pagos y pedidos») |
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
    account/           /account: pedidos recientes, perfil, contraseña, sesión (+ Server Actions)
      orders/          /account/orders (Mis pedidos) y /account/orders/[id] (detalle)
    admin/             Panel de admin (solo ADMIN): resumen, products/ (lista, nuevo, [id]),
                       orders/ (lista, [id]) y reviews/ (moderación)
    forbidden.tsx      Página 403 (forbidden())
    api/               Route Handlers para las islas cliente
      products/        GET /api/products (filtros, orden, paginación)
      products/by-ids/ GET /api/products/by-ids?ids=1,2
      products/facets/ GET /api/products/facets (conteos en vivo de los filtros)
      search/          GET /api/search?q= (autocompletado)
      auth/[...nextauth]/  Endpoints de Auth.js (OAuth, sesión, CSRF)
      checkout/orders/ POST: preparar el pedido · GET [id]: estado · POST [id]/pay: pagar
      stripe/webhook/  POST: eventos de Stripe (firma verificada)
      cron/expire-orders/  GET con CRON_SECRET: cancela pedidos pendientes viejos
    cart/ wishlist/ compare/ search/ category/ item/
    checkout/_components/  Pasos, resumen y confirmación del checkout
  components/
    ui/                Primitivos del sistema de diseño (barrel index.ts)
    layout/            Navbar, Footer, PageHeader, menú de cuenta, menús y paneles (carga diferida)
    auth/ account/     Formularios de login/registro y de /account
    admin/             Panel de admin: navegación, tablas, formulario de producto,
                       stock en línea, confirmaciones (ConfirmAction)
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
    rate-limit/        Rate limiting en Postgres (login, registro, reseñas, checkout)
    orders/            Pedidos: checkout en el servidor, webhook, limpieza, acceso, consultas, formato
    payments/          Pasarela de pago: Stripe, el mock de tests (STRIPE_MOCK) y su configuración
    email/             Envío (Resend o consola) y plantillas de los emails de pedidos
    admin/             Panel de admin: productos, pedidos (transiciones, reembolso),
                       reseñas, resumen; data.ts (lecturas que verifican el rol) y
                       actions.ts (Server Actions)
    images.ts          URLs de imágenes permitidas (las mismas que next.config.mjs)
    api-client.ts      Llamadas del navegador a /api/*
    productQuery.ts    ProductQuery <-> URL search params
    pricing.ts         Subtotal, envío y totales (carrito y checkout)
    argentina.ts       Provincias y zona horaria de la tienda
    flyToCart.ts       Animación "vuela al carrito" (Web Animations API)
    motion.ts motion-features.ts theme.ts metadata.ts utils.ts validations/
  stores/              Zustand: cart, wishlist, compare, recentlyViewed, theme, checkout, ui
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
- **Cerrar sesión** (cliente) borra la cookie de ese navegador: los otros
  dispositivos siguen con su sesión (lo esperable al cerrar sesión en el celular,
  por ejemplo). Una copia del token tomada antes (cookie filtrada, compu
  compartida) seguiría valiendo hasta que vence (30 días), así que `/account`
  ofrece **"Cerrar sesión en todos los dispositivos"** (`logoutEverywhereAction`):
  incrementa `sessionVersion` y cualquier copia deja de valer en el siguiente
  pedido. Para un **admin**, cerrar sesión siempre hace eso: un token de admin no
  sobrevive a su logout. Cambiar la contraseña también cierra las demás sesiones.
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
  `X-Forwarded-For` y definir `TRUSTED_PROXY_HOPS`). En ese modo una sola persona
  puede agotar el límite compartido y bloquear el login desde navegadores nuevos,
  el registro y el checkout de invitado para todos; por eso un servidor de
  producción sin `VERCEL=1` ni `TRUSTED_PROXY_HOPS` lo avisa en el log al arrancar
  (`src/instrumentation.ts`). Los límites por cuenta y los dispositivos conocidos no
  dependen de la IP.
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
    vez: después la copia es de la cuenta y no se vuelve a sumar. La fusión es
    **idempotente**: el navegador guarda lo que manda con un token aleatorio
    (`src/lib/lists/pending-merge.ts`) hasta adoptar la respuesta, un reintento
    reenvía lo mismo con el mismo token y el servidor lo registra por usuario en la
    misma transacción (tabla `ListMerge`, `src/lib/lists/merge.ts`), así que nunca
    suma dos veces. Las sincronizaciones de la cuenta corren de a una (la que pide
    la pestaña al volver espera a la fusión) y lo que el usuario cambió mientras la
    fusión estaba en curso se reaplica encima del resultado;
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
  y los listados en el próximo pedido (una edición que no cambia las estrellas solo
  invalida el tag del producto). Límites por usuario: 10 reseñas nuevas por hora,
  20 ediciones o borrados por hora, 60 votos "útil" cada 15 minutos. Cambiar el
  nombre en `/account` invalida los productos que reseñaste (el nombre se muestra en
  la lista cacheada). Las listas públicas no incluyen el id de cuenta del autor; la
  fecha es la de Argentina. "Útil" es un voto por usuario que se puede
  retirar (no sobre la reseña propia). **Compra verificada** = el autor tiene un
  pedido de su cuenta en PAID, SHIPPED o DELIVERED con ese producto (los pedidos de
  invitado no cuentan).
- **Lista de reseñas**: orden (recientes, útiles, mejor y peor valoradas) y páginas de
  5 en el servidor (`GET /api/products/<id>/reviews?sort=&page=`, en el data cache
  bajo los tags del producto); el resumen (promedio e histograma) es sobre todas.
  Lo del usuario (su reseña y sus votos) sale de
  `GET /api/products/<id>/reviews/mine`, sin caché.

## Checkout, pagos y pedidos

El flujo visible no cambió: **Envío → Pago → Revisar** y la confirmación. Lo que
cuesta plata lo decide el servidor (`src/lib/orders/checkout.ts`):

1. **Pago** solo *recolecta* la tarjeta: el Payment Element de Stripe (tematizado
   con los tokens del sitio en claro y oscuro, `stripeClient.ts`) hace
   `elements.submit()` + `stripe.createConfirmationToken()`. La tarjeta nunca pasa
   por nuestro servidor; el navegador guarda en memoria el id del token, la marca y
   los últimos 4 dígitos.
2. Al entrar a **Revisar**, `POST /api/checkout/orders` (zod: solo ids, cantidades,
   el formulario de envío, validado de nuevo, y el id del token) toma precios y
   stock de la base, calcula envío y totales con `lib/pricing`, lee marca y últimos
   4 del ConfirmationToken y crea el pedido **PENDING** con su PaymentIntent (ARS,
   `total × 100`, solo tarjeta, `metadata.orderId`, idempotency key por pedido). Si
   algo no tiene stock responde 409 con las líneas: el carrito se ajusta y la
   revisión se prepara de nuevo avisando qué cambió. Si los precios cambiaron, el
   carrito adopta los del servidor. Ese navegador recibe una cookie HttpOnly con un
   token de acceso al pedido (la base guarda su sha256): un invitado solo puede ver
   y pagar el pedido que creó, mientras está pendiente y hasta una hora después de
   pagarse o cancelarse; con sesión, el pedido queda en la cuenta y solo esa sesión
   lo abre (la cookie no alcanza). Cerrar sesión borra también esa cookie.
3. **Realizar pedido** (`POST /api/checkout/orders/<id>/pay`) confirma el
   PaymentIntent en el servidor con el ConfirmationToken. Si el banco pide 3D
   Secure, el navegador lo resuelve con `stripe.handleNextAction`. Un rechazo
   vuelve al paso Pago con el motivo en español (y el pedido no aparece en Mis
   pedidos: no hay pago que esperar). Pagar y volver a preparar el mismo pedido
   bloquean su fila mientras hablan con Stripe, así que no se intercalan: se cobra
   el total de las líneas que el pedido tiene, y una nueva revisión cambia el monto
   en Stripe antes de cambiar las líneas (si el pago ya salió, abre otro pedido).
4. La **confirmación** muestra el número real (`LEGO-001001`) y el estado, y
   consulta `GET /api/checkout/orders/<id>` cada 1,5 s hasta que el webhook lo marca
   pagado (o cancelado). Las líneas compradas salen del carrito del navegador.

**Webhook** (`/api/stripe/webhook`, `src/lib/orders/webhook.ts`): cuerpo crudo y
firma verificada con `STRIPE_WEBHOOK_SECRET`; cada evento se procesa una sola vez
(tabla `ProcessedStripeEvent`, en la misma transacción que sus cambios).
`payment_intent.succeeded` primero compara lo cobrado (`amount_received` y
`currency` del evento) con el total del pedido: si no coinciden, reembolsa y lo
cancela (`amount_mismatch`) sin tocar el stock. Después bloquea las filas de los
productos (en orden de id) y
descuenta el stock de todas las líneas o de ninguna: si a alguna le falta, el pedido
pasa a **CANCELLED** y se reembolsa (idempotency key por pedido); si no, pasa a
**PAID**, se quitan esas líneas del carrito de la cuenta, se invalida la caché del
catálogo de esos productos y sale el email de confirmación. Si el reembolso falla,
no se guarda nada y la respuesta es 500 para que Stripe reintente.
`payment_intent.payment_failed` deja el pedido PENDING (se puede pagar con otra
tarjeta) y lo saca de Mis pedidos hasta un nuevo intento; `payment_intent.canceled` lo cancela. Un pago que llega para un pedido ya
cancelado se reembolsa. `charge.refunded` (un reembolso total hecho fuera del
flujo, p. ej. desde el dashboard de Stripe) cancela un pedido PAID devolviendo el
stock (motivo `refunded`) o uno PENDING; en uno enviado o entregado solo anota el
reembolso; uno que un admin está cancelando lo deja a esa cancelación; un
reembolso parcial no cambia nada.

**Pedidos pendientes viejos**: un nuevo intento desde el mismo navegador actualiza
su pedido pendiente (y el monto del PaymentIntent) o, si ya no se puede pagar, lo
cancela. El resto los cancela `GET /api/cron/expire-orders` (con
`Authorization: Bearer $CRON_SECRET`) a las 24 h, junto con su PaymentIntent. En
Vercel lo agenda el `vercel.json` del repo (`/api/cron/expire-orders` todos los
días a las 4 UTC; Vercel manda el `CRON_SECRET` del proyecto solo); en otro hosting,
cualquier scheduler que haga ese GET. Sin `CRON_SECRET` la ruta responde 503.

**Mis pedidos** (`/account/orders`, `/account/orders/[id]`): solo los pedidos de la
cuenta que llegaron a "Realizar pedido" (un checkout abandonado no es una compra),
ordenados y fechados por el momento de "Realizar pedido", con línea de tiempo de
estado, las líneas como se compraron (nombre, precio e imagen
de ese momento), totales, dirección y tarjeta. El pedido de otra persona es un 404.
Los pedidos de invitado no se vinculan a una cuenta creada después.

**Emails** (`src/lib/email`): confirmación al pasar a PAID, "en camino" al pasar a
SHIPPED (`sendOrderShipped`, lo usa el admin) y "Cancelamos tu pedido" con el
monto reembolsado cuando se cancela un pedido cobrado (un admin cancela uno
pagado, un reembolso hecho en Stripe, sin stock al pagar o `amount_mismatch`):
un invitado no tiene otra forma de enterarse del reembolso. HTML simple con estilos en línea y
versión en texto. Con `RESEND_API_KEY` y `EMAIL_FROM` se envían por Resend (sin
dominio verificado, Resend solo entrega al dueño de la cuenta); sin ellas se
muestran en la consola del servidor.

**Configuración** (`src/lib/payments/config.ts`):

- **Stripe** necesita `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y
  `STRIPE_WEBHOOK_SECRET` (claves de test: <https://dashboard.stripe.com/test/apikeys>).
  En local, los webhooks llegan con la [Stripe CLI](https://docs.stripe.com/stripe-cli):
  `stripe listen --forward-to localhost:3000/api/stripe/webhook` imprime el
  `whsec_…` para `.env.local`. Tarjetas de prueba: `4242 4242 4242 4242` (aprobada),
  `4000 0027 6000 3184` (3D Secure), `4000 0000 0000 0002` (rechazada).
- **Sin esas variables** el paso Pago muestra "Pagos no configurados" (en dev, con
  la lista de lo que falta) y las rutas de checkout responden 503.
- **`STRIPE_MOCK=1`** (solo fuera de producción: con `NODE_ENV=production` se
  ignora) reemplaza Stripe por una pasarela en memoria (`src/lib/payments/mock.ts`)
  y el Payment Element por una lista de tarjetas de prueba. Es lo que usan los E2E
  y los tests de integración; el webhook sigue verificando firmas, así que los tests
  firman sus eventos con `stripe.webhooks.generateTestHeaderString`.
- Rate limits del checkout: 30 preparaciones y 15 pagos cada 15 minutos por usuario
  (o IP).
- **Con sesión**, el paso Envío llega con nombre y email de la cuenta y avisa que el
  pedido queda asociado a ella (el email se puede cambiar: es adonde van los avisos).
- El paso Pago (Stripe Elements, tarjetas de prueba) se carga bajo demanda con
  `next/dynamic` y se precarga mientras se completa el envío: no está en la primera
  carga de `/checkout`.
- **E2E contra Stripe real** (`e2e/stripe-live`, `npm run test:e2e:stripe`): con
  claves de **test** (`sk_test_`/`pk_test_`, más `STRIPE_WEBHOOK_SECRET`) en
  `.env.local` o el entorno, levanta su propio `next dev` en el 3200 sin
  `STRIPE_MOCK`, completa el Payment Element con `4242…` y con la tarjeta 3D Secure
  (resuelve el desafío), comprueba que Stripe cobró el total del servidor y entrega
  al webhook el evento `payment_intent.succeeded` real que Stripe registró (firmado
  con tu secret; si además corre `stripe listen --forward-to
  localhost:3200/api/stripe/webhook`, ese llega primero y el reenvío da
  `duplicate`). Sin claves se saltea. En CI corre el job opcional
  `e2e-stripe-live` solo si el repo tiene esos tres secrets.

## Panel de admin

`/admin` (solo ADMIN: `proxy.ts` manda a login, y cada página, lectura de
`src/lib/admin/data.ts` y Server Action de `src/lib/admin/actions.ts` llama a
`requireAdmin()`, con el rol leído de la base). Las lecturas van directo a la
base, nunca por la caché del catálogo; toda entrada pasa por zod
(`src/lib/validations/admin.ts`, filtros incluidos: un valor inválido en la URL
cae en "sin filtro").

- **Resumen**: pedidos de hoy (día calendario de Argentina), ingresos
  (PAID + SHIPPED + DELIVERED, total y de hoy), pedidos por enviar, pagos
  pendientes, stock bajo (≤ 5, con edición en línea), últimos pedidos y un aviso
  si hubo pedidos cancelados por `amount_mismatch` en los últimos 7 días (un
  incidente viejo no deja el aviso para siempre; el filtro "Cancelados: monto
  distinto" de Pedidos los muestra todos).
- **Productos**: lista con búsqueda (la misma de la tienda, o el id exacto),
  categoría, estado (en la tienda / archivados) y stock bajo (≤ 5, agotados
  incluidos, lo mismo que cuenta la tarjeta del resumen) o agotado, 20 por
  página; stock editable en la fila. El stock solo se escribe con
  compare-and-set: el formulario y la edición en línea mandan el stock que
  cargaron, y si una venta o un reembolso lo movió mientras tanto no se pisa
  (el formulario sin tocar Stock guarda el resto y deja el stock como está; un
  número nuevo sobre uno viejo se rechaza con "el stock cambió mientras
  editabas"). Crear y editar con todos los campos de la
  ficha; las imágenes son URLs (un archivo del sitio, `/images/…`, o
  `https://www.lego.com/cdn/…`: lo mismo que `images.remotePatterns` de
  `next.config.mjs` deja cargar a next/image, `src/lib/images.ts`) con vista
  previa. Cada escritura recalcula las columnas de búsqueda y expira los tags del
  catálogo con `updateCatalog()` (`products`, `product:<id>` y `categories`),
  así que la tienda muestra el cambio en el pedido siguiente.
- **Archivar / eliminar**: archivar (`Product.archivedAt`) saca el producto de
  toda lectura de la tienda (`LISTED` en `src/lib/api/catalog.ts`: catálogo,
  búsqueda, ficha → 404, facetas, conteos de categorías), de los carritos y
  favoritos (borra sus líneas) y lo vuelve "no disponible" para agregar, fusionar,
  reseñar o comprar. Restaurar lo devuelve a la venta. "Eliminar" borra solo un
  producto que ningún pedido incluye (con sus reseñas); si hay pedidos, lo
  archiva. Un pedido PENDING que ya tenía el producto se puede pagar igual (el
  precio ya quedó fijado).
- **Pedidos**: lista de pedidos realizados ("Realizar pedido", como los cuenta
  el resumen; los checkouts que no llegaron a pagar, solo con el filtro "Sin
  intento de pago"), con filtros por estado (más "Cancelados: monto distinto"),
  email o número (`LEGO-001001` / `1001`) y fechas del día en que se realizó
  (las mismas que muestra la tabla, con año), y el detalle con líneas,
  cliente, envío, tarjeta, PaymentIntent y reembolso de Stripe, línea de tiempo
  y el historial de cambios. Transiciones, exactamente las del diseño
  (`ADMIN_TRANSITIONS`, `src/lib/admin/orders.ts`):
  PENDING → CANCELLED (cancela el PaymentIntent; si el pago ya está en curso se
  rechaza y el webhook decide), PAID → SHIPPED (email "en camino") o CANCELLED
  (reembolso + stock devuelto), SHIPPED → DELIVERED. Cada cambio corre en una
  transacción que bloquea la fila del pedido y verifica el estado que vio el
  admin: un doble clic o un segundo admin no hacen nada dos veces. Cancelar un
  pagado va en tres pasos para que ningún resultado de la llamada a Stripe deje
  enviar un pedido ya reembolsado: (1) retiene el pedido (`refundRequestedAt`,
  confirmado antes de llamar a Stripe; un pedido retenido no se puede enviar);
  (2) pide el reembolso con la idempotency key del pedido (`order/<id>/refund`,
  la del webhook: nunca dos reembolsos); si la llamada falla, le pregunta a
  Stripe si el pago tiene un reembolso igual (la respuesta se perdió): si lo
  tiene sigue con ese, si no lo tiene libera el pedido sin cambios, y si Stripe
  no responde queda retenido hasta que el admin reintente la cancelación;
  (3) bajo el bloqueo, devuelve el stock y pasa a CANCELLED con el reembolso.
  Cada cambio queda en `OrderStatusChange` (quién, cuándo, de qué a qué, id del
  reembolso).
- **Reseñas**: todas, filtrables por producto, estrellas o texto; eliminar
  recalcula el rating en la misma transacción y expira el producto. Sin el
  límite de ediciones por usuario (ese es para los clientes).
- **UI**: primitivos del sistema (Table nuevo en `ui/`, Dialog para cada
  confirmación, toasts, Field/Select), filtros como formularios GET (funcionan
  sin JavaScript), navegación lateral que en teléfonos pasa arriba.

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
- El checkout vive en memoria y nunca ve datos de tarjeta: solo el id del
  ConfirmationToken de Stripe, la marca y los últimos 4 dígitos.

## Backend local setup

Requisitos: Node `^22.13` o `>=24` y Docker (Docker Desktop en Windows/macOS).

```bash
npm install                 # también genera el cliente de Prisma (postinstall)
cp .env.example .env.local  # los valores por defecto ya apuntan al Postgres de Docker;
                            # completá AUTH_SECRET (obligatoria), por ejemplo con:
                            # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
                            # (u openssl rand -base64 32)
npm run db:up               # Postgres 17 en localhost:5433, bases lego_store y lego_store_test
npm run db:migrate          # aplica las migraciones a lego_store
npm run db:seed             # catálogo, reseñas de ejemplo y el admin (ver "Admin")
npx playwright install chromium   # navegador de los tests de Storybook (npx vitest run) y de los E2E
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
  base antes del primer deploy. Para cobrar: las tres variables de Stripe, un
  endpoint de webhook en el dashboard de Stripe apuntando a
  `https://<dominio>/api/stripe/webhook` con los eventos `payment_intent.succeeded`,
  `payment_intent.payment_failed`, `payment_intent.canceled` y `charge.refunded` (su signing secret es
  `STRIPE_WEBHOOK_SECRET`), `CRON_SECRET` + el Cron Job de la limpieza (ver
  [Checkout, pagos y pedidos](#checkout-pagos-y-pedidos)), y opcionalmente
  `RESEND_API_KEY` / `EMAIL_FROM`. **Fuera de Vercel**: `AUTH_TRUST_HOST=true` y
  `TRUSTED_PROXY_HOPS` con la cantidad de proxies delante (sin eso todos los
  visitantes comparten los límites por IP; el servidor lo avisa al arrancar).
- **Headers de seguridad** (`next.config.mjs`, todas las rutas):
  `X-Frame-Options: DENY` y `Content-Security-Policy: frame-ancestors 'none'`
  (nadie puede meter `/admin` o `/account` en un iframe para clickjacking; el
  Payment Element es un iframe de Stripe dentro de nuestras páginas, no al revés),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, HSTS en producción y sin `X-Powered-By`.
- **`npm audit`**: las dependencias de producción no tienen vulnerabilidades (CI lo
  exige). Quedan avisos altos solo en herramientas de lint (GHSA-vfj7-8cjw-p6xm,
  `braces` vía `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` →
  `micromatch`); el único arreglo que ofrece npm es bajar a `eslint-config-next`
  14, así que es un riesgo aceptado (solo corre en desarrollo y CI sobre nuestro
  propio código) hasta que `eslint-config-next` actualice esa cadena.

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
  Skeleton, QuantitySelector, Spinner, Toast, Breadcrumbs, ThemeToggle, Table. Cada
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
- El layout raíz no carga zod: los módulos del bundle de todas las rutas
  (`components/layout`, `stores`, `providers`, `lib/lists/pending-merge.ts` y
  `sync-plan.ts`) solo pueden importar tipos de `@/lib/validations` (regla de
  ESLint); el servidor valida con zod igual.
- `npm run size` mide el JS de primera carga por ruta (gzip, sin los polyfills
  `noModule`) contra un presupuesto por ruta; CI lo corre en cada PR.
- Lighthouse CI (`lighthouserc.json`, móvil simulado) audita `/`, `/item/1`,
  `/category/helmet` y `/cart`; la última corrida local (3 corridas, `next start`)
  dio rendimiento 86 en `/` y 80-82 en fichas y categorías (mediana),
  accesibilidad 100 y buenas prácticas 100. El gate de SEO de CI es
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
  transacción, "útil" una vez, dueño, rate limit, invalidación, orden y páginas),
  checkout (totales y stock desde la base, PaymentIntent en ARS con idempotency key,
  reutilizar o cancelar el pedido pendiente, pagos rechazados, acceso por cookie o
  cuenta, limpieza de pendientes) y el webhook de Stripe con eventos firmados
  (firma, PAID con stock atómico, dos pagos por la última unidad → un reembolso,
  reenvíos idempotentes, reembolso que falla → 500 y reintento, email), y el
  panel de admin (`admin-*.test.ts`: crear / editar / archivar / eliminar
  productos y lo que la tienda ve después, transiciones de pedidos, reembolso +
  stock atómico e idempotente, reembolso sin respuesta (se encuentra en Stripe
  o el pedido queda retenido y no se envía), `charge.refunded`, dos
  cancelaciones a la vez, email al enviar,
  auditoría, filtros, resumen, moderación de reseñas y permisos de cada acción y
  lectura).
- `__tests__/lib`: parser de queries, búsqueda normalizada, caché del catálogo
  (tags e invalidación), validación de cuentas, callbackUrl, roles, rate limiter,
  la pasarela de Stripe con el SDK simulado (parámetros, errores, tokens), la
  configuración de pagos, el acceso a pedidos, los emails y utilidades.
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
  (favoritos, comparador y su barra), `checkout` (compra de invitado hasta PAID,
  tarjeta rechazada, validaciones, con axe), `orders` (compra con cuenta → Mis
  pedidos → detalle; otra cuenta recibe 404), `shell` (navbar,
  footer, páginas de información, 404), `state` (estado persistido), `a11y`
  (axe WCAG 2.1 AA en cada página, en modo claro y oscuro), `auth` (registro →
  logout → login → cuenta, redirección de rutas protegidas, callbackUrl, 403 de
  admin, cambio de contraseña, menú móvil, axe), `account-lists` (carrito y
  favoritos de visitante → cuenta, otro navegador, logout, cerrar sesión en todos
  los dispositivos revoca una cookie copiada), `security-headers` (anti-framing en
  `/admin` con sesión; HSTS y sin `X-Powered-By` en el proyecto `prod`), `admin` (editar un
  producto y verlo en la tienda; enviar y entregar un pedido pagado, con axe),
  `reviews` (login para
  opinar, publicar / editar / borrar, "útil", orden y páginas, axe) y el proyecto `prod` (navegación,
  transiciones y códigos de estado sobre el build de producción). Los E2E de
  cuentas usan emails `@e2e.lego-store.test`: el setup global los borra de la base
  de dev, limpia los contadores de rate limiting y crea un admin con una contraseña
  aleatoria; el teardown vuelve a borrarlos (y recalcula los ratings, porque sus
  reseñas se van en cascada). Los specs de reseñas comparan la página con la base y
  no con lo que mostraba antes: una corrida que falló a mitad puede dejar el data
  cache del servidor de dev un paso atrás hasta 1 h. Playwright levanta el servidor
  de dev con `STRIPE_MOCK=1` y un `STRIPE_WEBHOOK_SECRET` de test
  (`e2e/helpers/stripe.ts`); si reutiliza un `npm run dev` que ya estaba corriendo
  sin eso, el setup global falla explicando qué hacer. Los pedidos de los specs
  (emails `@e2e.lego-store.test`) se borran en el setup y el teardown, devolviendo
  el stock que tomaron.

CI (`.github/workflows/ci.yml`): lint, tipos, tests con cobertura, build de
Storybook, build, E2E, auditoría de dependencias de producción, presupuesto de
JS, Lighthouse y, solo si el repo tiene secrets de Stripe test, el E2E contra
Stripe real (`e2e-stripe-live`). Los jobs que necesitan datos levantan un servicio Postgres 17,
corren `prisma migrate deploy` y el seed antes de empezar.

## Licencia

MIT, ver [LICENSE](./LICENSE).
