# Arquitectura del backend

Cómo está armado el lado del servidor: dónde vive cada cosa en `src/lib`, cómo
se habla con la base, qué se cachea y cómo se invalida, cuándo se usa una Server
Action y cuándo un Route Handler, y las piezas transversales (sesión y roles,
rate limiting, emails, subidas, auditoría). El frontend está en
[architecture.md](./architecture.md); las tablas, en
[data-model.md](./data-model.md); los pagos, en [payments.md](./payments.md).

Regla de fondo: **el servidor es la fuente de verdad** de precios, descuentos,
totales, stock y permisos. El navegador manda ids, cantidades, el formulario de
envío y lo que recolectó el medio de pago; todo lo demás se recalcula desde
Postgres, y toda entrada pasa por zod (`src/lib/validations`).

## Mapa de `src/lib`

| Carpeta / archivo | Qué hace |
| --- | --- |
| `db/` | El cliente de Prisma: `getDb()` (instancia única, guardada en `globalThis` en desarrollo) y `createPrismaClient()` para el seed y los tests. |
| `api/` | Gateway de lecturas del catálogo (`server-only`): consultas Prisma en `catalog.ts`, envueltas en el data cache en `products.ts`; tags e invalidación en `cache.ts`; búsqueda en `search.ts`. |
| `auth/` | Auth.js (`index.ts`), sesión y permisos (`session.ts`: `getCurrentUser`, `requireUser`, `requireAdmin`, `authorizeRequest`), cuentas y contraseñas (`accounts.ts`, `password.ts`), adapter de Prisma, `callbackUrl` seguro, dispositivo conocido (`known-device.ts`), renovación firmada del token (`session-token.ts`), Server Actions de logout y Google (`actions.ts`). |
| `rate-limit/` | Limitadores de ventana fija sobre Postgres (`index.ts` los define), la IP del cliente (`client-ip.ts`). |
| `lists/` | Carrito y favoritos de una cuenta: Server Actions, fusión al ingresar (`merge.ts`), reglas de sincronización del navegador (`sync-plan.ts`, `pending-merge.ts`). |
| `reviews/` | Reseñas: Server Actions y escrituras (`mutations.ts`: rating recalculado en la misma transacción). |
| `orders/` | Pedidos: checkout de Stripe (`checkout.ts`, `webhook.ts`) y de Mercado Pago (`mercadopago.ts`), acceso por cookie o cuenta (`access.ts`), limpieza (`expire.ts`), consultas y formato, emails y caché después de un pago (`payment-effects.ts`, `notify.ts`), helpers de los Route Handlers (`http.ts`). |
| `payments/` | Proveedores de pago: la interfaz `PaymentProvider`, Mercado Pago (`mercadopago/`: SDK, firma, estados, mock), Stripe (`stripe.ts`, `stripe-provider.ts`) y su mock, y la configuración (`config.ts`). |
| `coupons/` | Reglas de cupones (`rules.ts`, puro), reserva y control en la base (`server.ts`), token de re-consulta (`recheck.ts`). |
| `pricing.ts` | Subtotal, descuento, envío y total (`orderTotals`): la misma función en carrito, checkout, pedido y monto cobrado. |
| `settings/` | Configuración de la tienda (`StoreSettings`): lectura cacheada, defaults y marcadores (`{{costo_envio}}`…). |
| `content/` | Páginas informativas desde la base (`ContentPage`). |
| `contact/`, `newsletter/` | Formulario de contacto, bandeja, suscripciones, enlaces firmados de baja. |
| `email/` | Envío (Resend o consola) y plantillas. |
| `uploads/` | Validación por bytes, re-codificación con sharp y almacenamiento (Vercel Blob o disco). |
| `admin/` | Panel de admin: lecturas que verifican el rol (`data.ts`), Server Actions (`actions.ts`), una escritura por entidad (`products.ts`, `orders.ts`, `coupons.ts`, `users.ts`, `categories.ts`, `themes.ts`, `settings.ts`, `content.ts`), auditoría (`audit.ts`, `actor.ts`), resumen y gráficos (`dashboard.ts`, `report.ts`), CSV (`csv.ts`, `exports.ts`). |
| `validations/` | Esquemas zod de todo lo que entra (formularios, queries, ids, filtros del admin). |
| `sitemap.ts` | Qué listan `/sitemap.xml` y `/robots.txt`. |

## Prisma y la base

- **Prisma 7** con el generador `prisma-client` (cliente TypeScript generado en
  `src/generated/prisma`, fuera de git; `npm install` lo genera en `postinstall`)
  y el driver adapter `@prisma/adapter-pg` sobre `pg`. La URL no está en el
  schema: la lee `prisma.config.ts` de `DATABASE_URL`, cargando `.env.local` y
  `.env` (`prisma/env.ts`; lo que ya está en el entorno gana).
- **Transacciones y bloqueos**: lo que mueve plata o stock corre en transacciones
  que bloquean filas con `SELECT … FOR UPDATE`: el pedido (`lockOrderRow`), el
  cupón al reservar o canjear, los productos en orden de id al descontar stock.
  El stock se descuenta con un `UPDATE` condicional (`stock >= cantidad`), de todas
  las líneas o de ninguna.
- **Reglas en la base**: `CHECK` escritos a mano en las migraciones (stock ≥ 0,
  totales que cierran, emails en minúsculas, códigos de cupón…) y un trigger que
  mueve los usos de cupones con el estado del pedido. Ver
  [data-model.md](./data-model.md).
- **Migraciones**: `prisma migrate dev` en desarrollo, `prisma migrate deploy` en
  CI y producción. Flujo en [CONTRIBUTING.md](../CONTRIBUTING.md#base-de-datos-y-migraciones).
- **Seed** (`prisma/seed.ts`, `prisma/seed/`): idempotente. Vuelve el catálogo de
  `src/data` a sus valores (stock incluido), usuarios, reseñas y pedidos de
  ejemplo, cupones (`BIENVENIDA10`, `LEGO500`), y escribe la configuración, los
  destacados y el contenido de las páginas solo si faltan (nunca pisa lo que
  editó un admin). Crea el admin de `ADMIN_EMAIL` / `ADMIN_PASSWORD`, o el de
  desarrollo con `SEED_DEV_ADMIN=1` (nunca con `NODE_ENV=production`).
- **`src/data`** es solo la fuente del seed: importarlo desde `src/` es un error
  de ESLint.

## Caché y tags

Las páginas se renderizan por pedido (el layout lee la sesión para el navbar),
pero las lecturas compartidas salen del **data cache de Next**
(`unstable_cache`, el modelo previo a Cache Components, que la app no activa)
con estos tags (`CATALOG_TAGS`, `src/lib/api/cache.ts`):

| Tag | Qué cubre | Quién lo invalida |
| --- | --- | --- |
| `products` | Toda lectura y lista de productos | Escrituras de productos, stock que se mueve con un pago o un reembolso, reseñas que cambian el rating |
| `product:<id>` | Un producto (su página, la búsqueda por id, sus reseñas) | Lo mismo, para ese producto |
| `categories` | Categorías y sus conteos | Crear, editar, mover, archivar o borrar productos y categorías |
| `themes` | El menú "Temas" | Escrituras de temas |
| `settings` | La configuración y los destacados de la home | Guardar una sección de `/admin/configuracion` |
| `content:<slug>` | El contenido publicado de una página informativa | "Publicar" en `/admin/contenido` |

- **Dos formas de invalidar**: `invalidateCatalog()` (`revalidateTag` con
  vencimiento inmediato) desde Route Handlers y webhooks; `updateCatalog()`,
  `updateSettingsCache()` y `updateContentCache()` (`updateTag`) desde Server
  Actions cuyo autor tiene que ver su cambio en la misma respuesta.
- **Solo se cachean lecturas acotadas**: una entrada por producto que existe, por
  categoría y por listado sin filtros. Búsquedas, rangos de precio, filtros
  arbitrarios, páginas profundas e ids desconocidos van directo a la base, así un
  visitante no puede hacer crecer la caché sin límite.
- **Revalidación por tiempo de 1 h** (`REVALIDATE_SECONDS`) como red de seguridad
  para un camino de escritura que se olvide de invalidar.
- **Lo que depende del usuario no se cachea**: carrito, favoritos, pedidos,
  cuenta, cupones, todo el admin (lee la base directo).
- **El checkout nunca usa la caché**: precios, stock, cupón y la regla de envío
  se leen en la misma transacción que escribe el pedido.
- **Varias instancias fuera de Vercel**: `revalidateTag` solo llega a la
  instancia que lo ejecutó. Ver [deploy.md](./deploy.md#caché-si-te-alojas-en-tu-propio-servidor).

## Server Actions y Route Handlers

| Usamos… | Para… | Dónde |
| --- | --- | --- |
| **Server Actions** | Mutaciones que dispara un formulario o un botón de nuestra UI, con respuesta para esa misma pantalla (`updateTag` + `refresh()`) | `src/app/(auth)/actions.ts` (login, registro), `src/app/account/actions.ts` (perfil, contraseña, sesiones), `src/lib/auth/actions.ts` (logout, Google), `src/lib/lists/actions.ts`, `src/lib/reviews/actions.ts`, `src/lib/contact/actions.ts` (contacto y newsletter), `src/lib/admin/actions.ts` |
| **Route Handlers** | Lo que llama un tercero (webhooks, cron), lo que necesita HTTP de verdad (streaming de CSV, subida con progreso de más de 1 MB, cookies del checkout, códigos de estado para el cliente) y las lecturas de las islas cliente | `src/app/api/**`, `src/app/uploads/[file]/route.ts`, `src/app/sitemap.ts`, `src/app/robots.ts` |

Route Handlers:

| Ruta | Método | Qué hace | Acceso |
| --- | --- | --- | --- |
| `/api/products`, `/api/products/by-ids`, `/api/products/facets`, `/api/search` | GET | Catálogo para las islas cliente | público |
| `/api/products/<id>/reviews` | GET | Página de reseñas (orden y página) | público |
| `/api/products/<id>/reviews/mine` | GET | La reseña y los votos del usuario | sesión |
| `/api/lists` | GET | Carrito y favoritos de la cuenta, frescos | sesión |
| `/api/checkout/coupon` | POST | Validar y cotizar un cupón | público, rate limit |
| `/api/checkout/orders` | POST | "Revisar": preparar el pedido PENDING | público, rate limit |
| `/api/checkout/orders/<id>` | GET | Estado del pedido (la confirmación lo consulta) | cookie del pedido o su cuenta |
| `/api/checkout/orders/<id>/pay` | POST | "Realizar pedido": cobrar | cookie o cuenta, rate limit |
| `/api/checkout/orders/<id>/sync` | POST | Vuelta de Checkout Pro: consultar el pago a Mercado Pago | cookie o cuenta |
| `/api/webhooks/mercadopago` | POST | Notificaciones de Mercado Pago | firma `x-signature` |
| `/api/stripe/webhook` | POST | Eventos de Stripe | firma `Stripe-Signature` |
| `/api/cron/expire-orders` | GET | Limpieza de pedidos pendientes | `Authorization: Bearer $CRON_SECRET` |
| `/api/admin/uploads` | POST | Subir una imagen | admin, mismo origen, rate limit |
| `/api/admin/export/<orders\|customers\|newsletter>` | GET | CSV en streaming | admin |
| `/api/test/mercadopago` | POST | Lo que Mercado Pago haría solo (E2E) | solo con `PAYMENTS_MOCK=1`; si no, 404 |
| `/api/auth/[...nextauth]` | GET/POST | Endpoints de Auth.js | Auth.js |
| `/uploads/<archivo>` | GET | Subidas locales escritas después de arrancar `next start` | público |
| `/sitemap.xml`, `/robots.txt` | GET | Para buscadores | público |

Toda Server Action y todo Route Handler protegido verifica la sesión por su
cuenta (ver abajo): no confía en `proxy.ts`.

## Sesión, roles y permisos

- **Auth.js v5** (`next-auth@5.0.0-beta.32`, `src/lib/auth/index.ts`): email +
  contraseña (Credentials, bcrypt) y Google solo si están `AUTH_GOOGLE_ID` y
  `AUTH_GOOGLE_SECRET`. Sesiones **JWT** en una cookie HttpOnly de 30 días (Credentials
  solo admite JWT, y leer la sesión no cuesta una consulta). Sin `AUTH_SECRET`
  falla cerrado: nadie puede ingresar.
- **Revocación**: el token lleva la `sessionVersion` del usuario y
  `getCurrentUser()` la compara con la base en cada pedido (una consulta,
  cacheada por render con `cache` de React). Cambiar la contraseña, "Cerrar sesión
  en todos los dispositivos", el logout de un admin y un bloqueo la incrementan.
  El rol y el bloqueo salen siempre de la base, nunca del token.
- **Roles** `USER` / `ADMIN`. El admin sale del seed (`ADMIN_EMAIL`) o del primer
  ingreso con Google con ese email verificado por Google; el registro público
  rechaza `ADMIN_EMAIL`. Un admin cambia roles desde `/admin/users`.
- **Dos capas**: `src/proxy.ts` manda a `/login?callbackUrl=…` a quien pide
  `/account/*` o `/admin/*` sin cookie de sesión (chequeo optimista, no escribe
  cookies). La autorización real está en cada página, Server Action y Route
  Handler:
  - `requireUser()`: sin sesión, redirige a `/login`;
  - `requireAdmin()`: además, un cliente recibe 403 (`forbidden()`, con
    `experimental.authInterrupts`);
  - `authorizeRequest({ admin })`: la versión para Route Handlers (401/403 en
    JSON);
  - `requireAdminActor()` (`src/lib/admin/actor.ts`): `requireAdmin()` más la IP
    confiable, para la auditoría.
- **`callbackUrl`** solo acepta rutas del mismo sitio (`safeCallbackUrl`).
- **Pedidos de invitado**: el navegador que preparó el pedido recibe una cookie
  HttpOnly con un token cuyo sha256 guarda el pedido (`src/lib/orders/access.ts`);
  con sesión, el pedido es de la cuenta y la cookie no alcanza.

## Rate limiting

Ventana fija con el contador en Postgres (tabla `RateLimit`, un
`INSERT … ON CONFLICT` atómico con el reloj de la base): vale entre instancias y
en serverless. Los límites están en `src/lib/rate-limit/index.ts`:

| Limitador | Límite | Sujeto |
| --- | --- | --- |
| `login-account-ip` | 5 / 15 min | cuenta + IP o dispositivo conocido (un login correcto lo borra) |
| `login-ip` | 50 / 15 min | IP |
| `login-account` | 30 / h | cuenta, desde dispositivos desconocidos |
| `register-ip` | 20 / h | IP |
| `password-change` | 5 / 15 min | usuario |
| `review-create` / `review-edit` / `review-helpful` | 10 / h, 20 / h, 60 / 15 min | usuario |
| `checkout-prepare` / `checkout-pay` | 30 / 15 min, 15 / 15 min | usuario o IP |
| `coupon-prepare` / `coupon-quote` / `coupon-recheck` | 15, 20 y 60 / 15 min | usuario o IP |
| `lists-write` / `lists-merge` | 300 / 15 min, 30 / h | usuario |
| `admin-upload` | 120 / h | admin |
| `contact-ip` / `contact-email` | 5 / h, 3 / h | IP, email |
| `newsletter-ip` / `newsletter-unsubscribe` / `newsletter-confirm` | 10, 30 y 30 / h | IP |

Para limitar algo nuevo: una entrada más en `rateLimits` y `consume(sujeto)`
antes de hacer el trabajo.

**La IP del cliente** (`clientIp()`, `src/lib/rate-limit/client-ip.ts`) solo
sale de headers que pone infraestructura de confianza: en Vercel, los que
reescribe su edge; detrás de tus proxies, `TRUSTED_PROXY_HOPS=N` toma la entrada
de `X-Forwarded-For` que agregó el proxy más externo. Sin ninguna de las dos no se
confía en ninguna IP y todos comparten el sujeto `unknown` (un servidor de
producción así lo avisa al arrancar, `src/instrumentation.ts`). Ver
[deploy.md](./deploy.md#trusted_proxy_hops).

## Emails

`sendEmail()` (`src/lib/email/send.ts`): con `RESEND_API_KEY` y `EMAIL_FROM` se
envía por Resend (con idempotency key cuando el que llama la pasa: un webhook
reintentado no duplica el email); sin ellas, en desarrollo y tests se muestra en
la consola y en producción solo se loguea el asunto y el destinatario
enmascarado. Nunca tira: se manda después de confirmar la transacción y un fallo
queda en el log.

| Email | Cuándo | Dónde |
| --- | --- | --- |
| Confirmación del pedido | Pasa a PAID | `sendOrderConfirmation` |
| Pago pendiente | Pasa a PAYMENT_PENDING (ticket con monto, link y vencimiento, o tarjeta en revisión) | `sendOrderPaymentPending` |
| No se acreditó el pago | Un PAYMENT_PENDING se cancela (ticket vencido, rechazo tras revisión) | `sendOrderPaymentLapsed` |
| En camino | El admin lo pasa a SHIPPED | `sendOrderShipped` |
| Cancelamos tu pedido | Se cancela un pedido cobrado (admin, reembolso externo, sin stock, otro monto, cupón agotado, pago tardío) | `sendOrderCancelled` |
| Aviso de mensaje nuevo | Llega un mensaje de contacto (a `STORE_NOTIFY_EMAIL` o al email de contacto de la configuración) | `src/lib/email/contact.ts` |
| Bienvenida al newsletter / confirmar re-suscripción | Suscripción nueva / email dado de baja que se vuelve a suscribir | `src/lib/email/contact.ts` |

Plantillas en HTML simple con estilos en línea y versión en texto; todo lo que
viene del usuario pasa por `escapeHtml`.

## Subidas de imágenes

`POST /api/admin/uploads` (admins, mismo origen, 120 por hora) acepta JPEG, PNG,
WebP o AVIF **por sus bytes** (nunca SVG, GIF ni HEIC), hasta 8 MB y 40
megapíxeles; sharp la re-codifica a WebP (máximo 1600 px de lado, sin metadatos)
con un nombre aleatorio. El almacenamiento es un adaptador
(`UploadStorage`, `src/lib/uploads/storage.ts`):

- `BLOB_READ_WRITE_TOKEN` definido → **Vercel Blob** (`put` público bajo
  `uploads/`, servido desde el host del propio store,
  `<id>.public.blob.vercel-storage.com`, el único que `next.config.mjs` y
  `isAllowedImageUrl` permiten: `src/lib/blob-host.mjs`);
- si no, y fuera de Vercel → **disco** (`public/uploads`, gitignored, o
  `UPLOADS_DIR`), servido en `/uploads/<nombre>` (`next dev` lo sirve solo; un
  `next start` sirve los archivos nuevos con `src/app/uploads/[file]/route.ts`);
- en Vercel sin token → no hay dónde escribir: la subida dice que no está
  configurada y el admin puede pegar una URL.

Las subidas no se borran (un pedido viejo puede seguir usándolas). Solo el
adaptador de disco tiene tests; el de Blob no se probó con un token real.

## Auditoría

`AuditLog` registra toda mutación del admin **en la misma transacción** que el
cambio (`recordAudit`, `src/lib/admin/audit.ts`): el admin y su IP confiable, la
acción `<entidad>.<verbo>`, la entidad y su id, y `{campo: [antes, después]}`
(`diffFields`) o lo guardado al crear o borrar (`snapshotFields`). Los tipos de
entidad son `product`, `order`, `review`, `coupon`, `user`, `category`, `theme`,
`upload`, `settings`, `content`, `message`, `subscriber` y `export`. Los cambios
de estado de pedidos además quedan en `OrderStatusChange`, que alimenta la línea
de tiempo. Lista de acciones en [admin.md](./admin.md#auditoría).

## Tareas programadas y arranque

- `GET /api/cron/expire-orders` (con `CRON_SECRET`): cancela los PENDING sin
  tocar desde hace 24 h (con su PaymentIntent) y revisa en Mercado Pago los
  PAYMENT_PENDING con el ticket vencido hace más de un día o pendientes desde hace
  una semana. `vercel.json` lo agenda todos los días a las 4 UTC.
- `src/instrumentation.ts` avisa al arrancar si un servidor de producción no
  confía en ninguna IP o si corre con `PAYMENTS_MOCK`.

## Detalle: cuentas y sesiones

Las decisiones de diseño de la autenticación, con sus trade-offs.

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
  también sale siempre de la base, nunca del token. `GET /api/auth/session` (lo que
  lee un cliente) hace la misma comparación: para una cuenta bloqueada o un token de
  otra versión responde `null`, como sin sesión, y no renueva la cookie.
- **Cerrar sesión** (cliente) borra la cookie de ese navegador: los otros
  dispositivos siguen con su sesión (lo esperable al cerrar sesión en el celular,
  por ejemplo). Una copia del token tomada antes (cookie filtrada, compu
  compartida) seguiría valiendo hasta que vence (30 días), así que `/account`
  ofrece **"Cerrar sesión en todos los dispositivos"** (`logoutEverywhereAction`):
  incrementa `sessionVersion` y cualquier copia deja de valer en el siguiente
  pedido. Para un **admin**, cerrar sesión siempre hace eso: un token de admin no
  sobrevive a su logout. Cambiar la contraseña también cierra las demás sesiones.
  Es un trade-off aceptado: incrementar `sessionVersion` en cada logout de cliente
  cerraría también sus otros dispositivos, y una lista de tokens revocados (jti)
  costaría una consulta más por pedido.
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
- **El registro dice si un email ya tiene cuenta** ("Ya existe una cuenta con ese
  email"); el login no (mismo mensaje y un bcrypt de relleno para emails
  desconocidos). Es el trade-off habitual de una tienda sin verificación de email:
  un registro que no lo revele necesita mandar un email a la dirección existente.
  Lo frena el límite de 20 registros por IP por hora.
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
  hora; votos "útil": 60 por usuario cada 15 min; cambios de carrito y favoritos:
  300 por usuario cada 15 min, y 30 fusiones al ingresar por hora (cada una escribe
  hasta 200 + 200 filas). Un dispositivo nuevo bloqueado por el límite ve "Espera unos
  minutos" sin el tiempo exacto, y no hay desbloqueo por email (no hay flujo de
  recuperación de contraseña todavía). Para limitar algo nuevo (contacto,
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
  [architecture.md](./architecture.md#renderizado-y-caché)).
- **Configuración**: `AUTH_SECRET` es obligatoria. Sin ella Auth.js falla cerrado:
  todas las páginas se ven sin sesión, nadie puede ingresar y `/login` y `/register`
  avisan que falta. Fuera de Vercel, `next start` necesita `AUTH_TRUST_HOST=true`
  (o `AUTH_URL`) para que Auth.js acepte el host.

## Detalle: carrito, favoritos y reseñas

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

## Detalle: configuración, contenido, contacto y newsletter

- **Configuración** (`StoreSettings`, una sola fila; `src/lib/settings`):
  costo de envío y umbral de envío gratis, barra de anuncio (texto, enlace a una
  ruta del sitio o una URL https, activa, y un *tono*: un par de tokens del
  sistema, nunca un color libre), contacto (email, teléfono, ubicación,
  horario) y redes, y los destacados de la home (`FeaturedProduct`, hasta 8 en
  orden con "Subir" / "Bajar"; un archivado deja de mostrarse). Cada sección se
  guarda sola, validada con zod en el servidor y auditada
  (`settings.<sección>`). Las páginas la leen por el data cache (tag
  `settings`, que el guardado expira); el carrito recibe la regla de envío del
  layout (`ShippingRulesProvider`) y **el servidor cotiza cada pedido con la
  regla leída de la base en la misma transacción** (`readShippingRules`): lo
  que cobra el proveedor nunca sale de una copia en caché. `lib/pricing` ya no
  tiene constantes: toma la regla como argumento (`DEFAULT_SHIPPING_RULES`,
  $299 / $5.000, es la de una base sin la fila, el seed y los tests). El envío
  nunca es $0 (check en la base): para envío gratis siempre, umbral $1. El seed
  escribe la fila y los destacados solo si faltan.
- **Marcadores**: la barra de anuncio y las páginas de contenido aceptan
  `{{costo_envio}}`, `{{envio_gratis_desde}}`, `{{dias_devolucion}}`,
  `{{dias_entrega_min}}`, `{{dias_entrega_max}}`, `{{tienda}}`, `{{email}}`,
  `{{telefono}}` y `{{horario}}` (`src/lib/settings/placeholders.ts`), que se
  reemplazan al mostrar: cambiar el envío cambia también el texto que lo cita.
- **Contenido** (`ContentPage`: borrador y publicado, JSON validado con zod al
  escribir y al leer; `src/lib/content`): /faq, /envios, /devoluciones,
  /nosotros, /privacidad, /terminos y la introducción de /contacto. Una página
  es título, introducción (Markdown en línea) y bloques ordenados: texto
  Markdown (títulos, listas, enlaces, tablas), grupos de preguntas frecuentes
  (pregunta y respuesta Markdown, en orden; de ellos sale el JSON-LD FAQPage,
  escapado para el `<script>`) y listas de pasos o tarjetas. El Markdown pasa
  por react-markdown + remark-gfm **sin HTML crudo** (`skipHtml`), sin imágenes,
  y los enlaces solo conservan rutas del sitio, http(s), mailto y tel. Las
  páginas legales numeran sus `##` con tabla de contenidos y muestran la fecha
  de publicación. Lo que cada página agrega por su cuenta (las cifras de envío
  de la configuración, las de "Sobre nosotros", el formulario de contacto, los
  botones) sigue en código. El editor (`/admin/contenido/<slug>`) ordena
  bloques e ítems con teclado (el foco acompaña, una región `aria-live`
  anuncia), tiene vista previa con los mismos componentes de la página y
  "Guardar borrador" (la página no cambia), "Publicar" (expira el tag
  `content:<slug>` y la ruta) y "Descartar borrador"; todo auditado
  (`content.draft` / `.publish` / `.discard`). El seed publica el texto de
  siempre una vez y nunca pisa lo que editó un admin.
- **Mensajes de contacto** (`ContactMessage`): el formulario de /contacto los
  guarda (zod, 5 por hora por IP y 3 por email, un campo trampa para bots;
  vincula la cuenta si hay sesión) y avisa a la tienda por email
  (`STORE_NOTIFY_EMAIL`, o el email de contacto de la configuración; a consola
  sin Resend). `/admin/mensajes`: bandeja (nuevos y leídos; archivados aparte),
  filtros por motivo, texto y fechas, marcar leído / no leído, archivar y
  "Responder por email" (mailto con el asunto y el mensaje citado); auditado
  (`message.*`).
- **Newsletter** (`NewsletterSubscriber`): el pie de página suscribe (zod, 10
  por hora por IP) y manda la bienvenida con el enlace de baja. El token del
  enlace es el id del suscriptor firmado con `AUTH_SECRET` (HMAC-SHA256, nada
  guardado en la base): `unsubscribeUrl(id)` de `src/lib/newsletter` lo arma
  igual para cualquier envío futuro, sirve aunque la persona se haya vuelto a
  suscribir, y el CSV del newsletter lo trae en la columna "Enlace de baja"
  (solo activos) para la herramienta de envíos. Cambiar `AUTH_SECRET` invalida
  todos los enlaces ya enviados (y las sesiones). El formulario contesta siempre
  "¡Listo! Revisa tu correo: si hace falta, te pedimos ahí que confirmes la
  suscripción.", cierto en los tres casos y sin revelar quién está; suscribir
  un email ya suscripto no manda nada. `/newsletter/baja?token=…`
  muestra a qué dirección corresponde (enmascarada) y da de baja con un botón:
  un GET nunca da de baja, porque los filtros de correo abren los enlaces.
  Una baja no se deshace desde el pie: suscribir de nuevo un email dado de baja
  solo le manda un email de confirmación (`/newsletter/confirmar?token=…`,
  vence en 7 días, como mucho uno por día por dirección) y sigue de baja hasta
  que su dueño aprieta "Confirmar la suscripción".
  `/admin/newsletter` lista, busca, exporta y "Da de baja" a quien lo pide por
  otra vía (con confirmación, auditado como `subscriber.unsubscribe`).

## Headers de seguridad y dependencias

- `next.config.mjs` manda en todas las rutas `X-Frame-Options: DENY` y
  `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri
  'self'` (nadie puede meter `/admin` o `/account` en un iframe; el Payment Brick
  y el Payment Element son iframes de Mercado Pago y Stripe dentro de nuestras
  páginas, no al revés), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, HSTS en producción y sin
  `X-Powered-By`. Falta un `script-src` con nonces por pedido: no hay ningún sink
  de XSS conocido (el JSON-LD pasa por `serializeJsonLd`, los emails por
  `escapeHtml`, el Markdown del contenido sin HTML crudo), pero un XSS futuro no
  quedaría contenido.
- `npm audit --omit=dev` no tiene vulnerabilidades altas (CI lo exige). Quedan
  avisos solo en herramientas de lint (`braces` vía `eslint-config-next`), un
  riesgo aceptado porque solo corren en desarrollo y CI sobre código propio.
