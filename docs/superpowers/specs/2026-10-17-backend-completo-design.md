# Backend completo para lego-store — Diseño

Fecha: 2026-10-17

## Intención

lego-store hoy es un frontend Next.js 14 pulido pero 100% simulado: los productos
están hardcodeados en `src/data/products.ts`, todo el estado vive en localStorage
(Zustand) y el checkout inventa un ID de pedido con un `setTimeout`. El objetivo es
convertirlo en una tienda **full funcional**: cada funcionalidad que la UI ya muestra
tiene que funcionar de verdad contra un servidor y una base de datos, más lo
necesario para que eso tenga sentido (usuarios, pedidos, pagos, admin).

Es un proyecto propio, no una tienda que vaya a vender LEGO reales a clientes ya
mismo — pero tiene que funcionar de punta a punta como si lo fuera.

**No es un template.** Nunca se vendió como tal y no se va a vender: no hace falta un
modo "sin backend" ni fallback a datos locales. La app requiere Postgres para correr;
Stripe y Resend son requeridos para pagar/enviar emails (con el logueo a consola de
emails descrito abajo para dev). Los restos de empaquetado como template
(`MARKETPLACE.md`, `dist/*.zip`, `scripts/package-for-sale.sh`) se eliminan, y el
README pasa a describir el proyecto en vez de un producto a la venta.

## Objetivos

1. **Catálogo desde la base de datos**: productos, categorías, temas, filtros
   (type, age, theme, interests, pieces, highlight), orden, paginación/scroll infinito,
   búsqueda y autocompletado, productos relacionados, destacados y en oferta.
2. **Usuarios**: registro, login, logout, sesión persistente.
3. **Carrito persistente por usuario**: visitantes usan localStorage como hoy; al
   loguearse el carrito local se fusiona con el del servidor y desde ahí se sincroniza.
4. **Wishlist persistente por usuario**, con la misma lógica de fusión que el carrito.
5. **Reseñas reales**: crear (requiere login), listar por producto, rating promedio
   calculado en servidor, "útil" una vez por usuario, marca "compra verificada" si el
   usuario tiene un pedido pagado con ese producto.
6. **Checkout real**: pedido guardado en DB, precios y envío recalculados en servidor,
   pago con Stripe (modo test), descuento de stock al confirmarse el pago.
7. **Mis pedidos**: listado y detalle de pedidos del usuario con su estado.
8. **Email de confirmación** de compra (Resend).
9. **Panel de admin**: CRUD de productos (incluye stock y precios), listado de pedidos
   y cambio de estado.

## No-objetivos

- Comparar y "vistos recientemente" **se quedan solo en el navegador** (localStorage).
  No ganan nada con un servidor.
- Tema claro/oscuro, idioma y búsquedas recientes siguen en el cliente.
- Subida de imágenes: el admin carga **URLs** de imágenes, igual que el seed actual.
- Multi-moneda, impuestos, cupones, múltiples métodos de envío, tracking de envíos.
- Backend separado (Express, NestJS, etc.).

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que el servidor confíe en precios, totales o stock que manda el cliente.
- Que datos de tarjeta pasen por nuestro servidor o se guarden en algún lado.
- Romper la experiencia actual: la UI, animaciones, dark mode, i18n y el flujo de 3
  pasos del checkout tienen que seguir viéndose y sintiéndose igual.
- Que un visitante sin cuenta no pueda usar carrito/wishlist como hoy.
- Romper los tests E2E existentes sin reemplazarlos por equivalentes.

## Restricciones

- Todo dentro del **mismo proyecto Next.js** (App Router): Route Handlers y
  Server Actions. Un solo repo, desplegable en Vercel (donde ya está la demo).
- Se construye **sobre el resultado del overhaul de UI** (rama `feat/ui-overhaul`:
  Next 16, React 19, Tailwind 4, primitivos shadcn/Base UI, `src/lib/api` como única
  puerta de datos). Las páginas nuevas (login, cuenta, admin) usan esos primitivos y
  tokens. En Next 16 el middleware se llama `proxy.ts`.
- Sin cuentas externas todavía: todo debe poder desarrollarse y testearse local con
  Postgres en Docker, Stripe simulado vía webhook firmado de test y emails a consola.
  Con keys reales de test en `.env.local` funciona contra Stripe/Resend sin cambios.
- Moneda: **ARS**, precios enteros en pesos como hoy (`formatPrice` usa `es-AR`/ARS).
  Para Stripe se convierten a centavos (`price * 100`).
- Envío: $299, gratis desde $5000 de subtotal — misma regla que la UI actual, pero
  calculada en el servidor.
- Textos de UI y errores en español, consistentes con lo existente.

## Decisiones tomadas (aprobadas por Tomy)

- **Stack**: PostgreSQL + Prisma + Auth.js (NextAuth v5).
- **Pagos**: Stripe en modo test.
- **Emails**: Resend.
- Alcance: todo lo listado en Objetivos.

## Decisiones mías (el builder puede revisarlas, pero son el default)

**Base de datos**
- Local: Postgres en Docker vía `docker-compose.yml` (Docker ya está instalado).
  Producción: Postgres serverless (Neon / Vercel Postgres) por `DATABASE_URL`.
- Seed (`prisma db seed`) a partir de los 22 productos de `src/data/products.ts` y las
  reseñas mock de `reviewStore.ts`. Ojo: las reseñas mock usan `productId` tipo
  `"helmet-captain-rex"` que no coincide con los IDs reales (`"1"`, `"2"`…) — el seed
  las mapea a los productos correctos por nombre.
- Los IDs de producto existentes se conservan (las URLs `/item/1` siguen funcionando).

**Modelo de datos (orientativo)**
- `User` (email, nombre, passwordHash, role: USER | ADMIN)
- Tablas de Auth.js que hagan falta
- `Product` (mismos campos que el tipo `Product` actual; `interests` y `images` como arrays)
- `CartItem` (userId, productId, quantity) — único por (userId, productId)
- `WishlistItem` (userId, productId) — único por par
- `Review` (userId, productId, rating, title, comment, createdAt) — una por usuario y producto
- `ReviewHelpful` (userId, reviewId) — único por par
- `Order` (userId opcional, email, datos de envío como snapshot, subtotal, shipping,
  total, status, stripePaymentIntentId, createdAt)
- `OrderItem` (orderId, productId, nombre/precio/imagen como snapshot, quantity)
- `OrderStatus`: PENDING → PAID → SHIPPED → DELIVERED, y CANCELLED

**Auth**
- Email + contraseña (Credentials, hash con bcrypt/argon2), sesiones JWT.
- Google OAuth opcional: se activa solo si están las env vars.
- Admin: el usuario cuyo email coincide con `ADMIN_EMAIL` recibe rol ADMIN (en seed y
  al registrarse). *Desvío al implementar*: el formulario de registro rechaza
  `ADMIN_EMAIL`; como no hay verificación de email, el primero en registrarse con esa
  dirección en una base nueva sería admin. El admin sale del seed o de un primer
  ingreso con Google con el email verificado (docs/backend.md, «Detalle: cuentas y sesiones»). `/admin/*` y las acciones de admin protegidas por middleware +
  verificación en servidor.
- Páginas nuevas: `/login`, `/register`, `/account` (perfil + mis pedidos),
  `/account/orders/[id]`. Navbar muestra estado de sesión.

**Checkout y pagos**
- Se permite **checkout como invitado** (el email sale del formulario de envío); si
  hay sesión, el pedido queda asociado al usuario.
- El paso "Pago" reemplaza el formulario de tarjeta casero por el **Stripe Payment
  Element** embebido, manteniendo el flujo visual de 3 pasos. El `paymentSchema` de
  tarjeta deja de usarse.
- Flujo: al pasar a pago, el servidor valida stock, recalcula totales, crea el `Order`
  en PENDING y un PaymentIntent. El **webhook** de Stripe (`payment_intent.succeeded`)
  marca el pedido PAID, descuenta stock con un update condicional atómico, vacía el
  carrito del usuario y manda el email. Si al confirmar ya no hay stock suficiente, se
  reembolsa automáticamente y el pedido pasa a CANCELLED.
- La pantalla de confirmación muestra el ID real del pedido.
- Desarrollo local de webhooks con Stripe CLI (`stripe listen`), documentado en docs/payments.md.

**Capa de datos en el frontend**
- Hoy varias páginas importan `@/data/products` directamente (home, category, item,
  search, wishlist, SearchAutocomplete). Todas pasan a leer del servidor — Server
  Components donde se pueda, y React Query (ya instalado) + Route Handlers para lo
  interactivo (scroll infinito, autocompletado, filtros).
- `src/lib/api/products.ts` mantiene sus firmas pero implementado con Prisma (en
  servidor) / fetch (en cliente). `src/data/products.ts` queda solo como fuente del seed.
- Las stores de Zustand de carrito y wishlist se mantienen como capa de UI; cuando hay
  sesión sincronizan con el servidor. `reviewStore` y `checkoutStore` dejan de tener
  lógica simulada.

**Detalles resueltos tras la revisión (decisiones mías)**
- *Qué paso cobra*: en "Pago" el Payment Element solo **recolecta** la tarjeta
  (`elements.submit()` + `stripe.createConfirmationToken()`); "Revisar" muestra marca y
  últimos 4 dígitos sacados del ConfirmationToken, y el botón "Realizar pedido" confirma
  el PaymentIntent en servidor con ese token. El flujo visible Envío → Pago → Revisar no
  cambia. El Order PENDING + PaymentIntent se crean al entrar a "Revisar".
- *Rating*: `Product.rating` pasa a ser una columna cacheada = promedio de sus reseñas,
  recalculada en cada reseña nueva. Productos sin reseñas muestran "Sin reseñas" y se
  ordenan al final en "recomendados". El seed agrega unas pocas reseñas de ejemplo por
  producto para que el catálogo de demo no quede vacío.
- *Cambios de estado del admin*: PENDING → CANCELLED; PAID → SHIPPED | CANCELLED;
  SHIPPED → DELIVERED. Cancelar un pedido PAID hace reembolso en Stripe y devuelve el
  stock (misma lógica atómica que el webhook, con tests). SHIPPED/DELIVERED no se
  cancelan. Se manda email al cliente al pasar a PAID y a SHIPPED.
- *Emails*: si faltan `RESEND_API_KEY` o `EMAIL_FROM` se loguean a consola en vez de
  enviarse (dev, tests, CI). docs/deploy.md explica que sin dominio verificado Resend solo
  entrega al dueño de la cuenta.
- *Pedidos de invitado*: no se vinculan automáticamente a una cuenta creada después con
  el mismo email (no hay verificación de email, sería un riesgo). No cuentan para
  "compra verificada".
- *CI y E2E de compra*: el E2E de CI no depende de Stripe real: un endpoint/helper solo
  para test genera el evento `payment_intent.succeeded` firmado con el
  `STRIPE_WEBHOOK_SECRET` de test (`stripe.webhooks.generateTestHeaderString`). Un E2E
  extra contra Stripe test real corre solo si hay secrets configurados. El deploy de la
  demo en Vercel (Neon + endpoint de webhook) se documenta, no se automatiza.

**Validación y seguridad**
- Toda entrada al servidor validada con Zod (ya está en el proyecto).
- Rate limiting básico en login/registro y creación de reseñas.

**Calidad**
- Tests con Vitest para la lógica de servidor (totales, stock, fusión de carrito,
  permisos) contra una DB de test.
- Los E2E de Playwright existentes se actualizan para el nuevo flujo; se agrega un E2E
  de compra completa con tarjeta de test de Stripe.
- CI: se agrega servicio Postgres al workflow para correr migraciones y tests.
- `.env.example` actualizado con todas las variables nuevas
  (`DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `STRIPE_*`, `RESEND_API_KEY`,
  `AUTH_GOOGLE_*` opcionales).

## Lo que queda a criterio del builder

- Versiones exactas de Prisma / Auth.js / SDKs compatibles con Next 14.2.
- Estructura de carpetas del código de servidor, nombres de rutas API.
- Diseño visual de las páginas nuevas (login, cuenta, admin), siguiendo los
  componentes y tokens existentes (`src/components/ui`, Tailwind).
- Estrategia de búsqueda (ILIKE alcanza para 22 productos; full-text es opcional).
- Cómo partir el trabajo en etapas.

## Notas de implementación: checkout y pedidos

Decisiones tomadas al construir la etapa (docs/payments.md tiene el detalle):

- *Acceso de invitados*: crear el pedido deja en el navegador una cookie HttpOnly con
  un token aleatorio (la base guarda su sha256). Con ella un invitado ve el estado y
  paga solo su pedido; con sesión cuenta también el dueño. El id del pedido solo no
  da acceso a nada.
- *Número de pedido*: `Order.number` autoincremental desde 1001, mostrado como
  `LEGO-001001`.
- *"Mis pedidos"* lista los pedidos con `submittedAt` (llegaron a "Realizar
  pedido"): un checkout abandonado no aparece aunque la limpieza lo cancele.
- *Carrito tras el pago*: el webhook quita del carrito de la cuenta solo las
  líneas compradas (lo agregado en otra pestaña durante el pago queda), y el
  navegador hace lo mismo con su copia.
- *Pendientes viejos*: un nuevo intento desde el mismo navegador actualiza su
  pedido pendiente (y el monto del PaymentIntent) o lo cancela si ya no se puede
  pagar; `GET /api/cron/expire-orders` (con `CRON_SECRET`) cancela el resto a las
  24 h.
- *Tests sin Stripe*: `STRIPE_MOCK=1` (ignorado con `NODE_ENV=production`) cambia la
  pasarela por una en memoria y el Payment Element por tarjetas de prueba; el
  webhook se ejercita con eventos firmados con el secreto de test. El E2E contra
  Stripe test real existe (`npm run test:e2e:stripe`, `e2e/stripe-live`) y en CI
  es el job opcional `e2e-stripe-live`, que solo corre si el repo tiene los secrets
  de Stripe test. Un build de producción nunca usa el mock, aunque se arranque con
  otro `NODE_ENV`.
- *Pagar con la tarjeta revisada*: "Realizar pedido" lee el ConfirmationToken y
  rechaza (422) uno de otra tarjeta que la que mostró "Revisar"; el cliente vuelve
  al paso Pago.
- *"Recomendados"* es el orden "Destacados" (el default): productos con reseñas
  primero, después el orden del catálogo. "Mejor calificados" también deja al final
  a los que no tienen (rating 0).

## Notas de implementación: panel de admin

- *Archivar*: `Product.archivedAt`. "Eliminar" un producto que algún pedido
  incluye lo archiva (sale de la tienda, carritos y favoritos; los pedidos
  conservan el vínculo); uno sin pedidos se borra.
- *Auditoría*: tabla `OrderStatusChange` (pedido, de, a, admin, email del admin,
  reembolso, fecha). Solo los cambios del admin; los del webhook y la limpieza
  siguen en las fechas del pedido (`paidAt`, `cancelledAt`…).
- *Cancelar un PAID*: en tres pasos, para que ningún resultado del reembolso deje
  el pedido en condiciones de enviarse: (1) con la fila bloqueada se marca
  `refundRequestedAt` (el pedido queda retenido), (2) el reembolso a Stripe va fuera
  de la transacción, con la misma idempotency key que el webhook, y (3) con la fila
  bloqueada otra vez se devuelve el stock y se cancela. Si la llamada falla, se le
  pregunta a Stripe si el pago ya tiene un reembolso (la respuesta se perdió): si lo
  tiene se sigue con él, si no se levanta la retención; si Stripe no responde, el
  pedido queda retenido hasta que el admin reintente.
- *Imágenes*: solo URLs que `next/image` puede cargar (rutas del sitio o el CDN
  de lego.com de `remotePatterns`).
- *Moderación*: el admin borra reseñas sin pasar por el límite de ediciones de
  los clientes.
- Las tablas `ListMerge` (etapa de listas) y el token de fusión no estaban
  mencionados acá: ver docs/backend.md, «Detalle: carrito, favoritos y reseñas».

## Ampliación: decisiones de Tomy (2026-10-17)

Decidido por Tomy el 2026-10-17, después de terminar la base. Donde estas
decisiones contradicen secciones anteriores (por ejemplo, los no-objetivos
"subida de imágenes: solo URLs" y "cupones"), **mandan estas**. Las demás
reglas siguen igual: el servidor es la fuente de verdad de precios, descuentos,
totales, stock y permisos; toda entrada se valida con Zod; nada depende de
cuentas externas reales para desarrollar o testear.

### Pagos: Mercado Pago principal, Stripe alternativa

- **Mercado Pago es el medio de pago principal**, con Checkout Bricks embebido
  en el paso "Pago": tarjetas (con cuotas), dinero en cuenta y efectivo
  (tickets). Moneda ARS, montos en pesos (MP usa importes decimales, no
  centavos).
- **Stripe queda como alternativa** detrás de una capa `PaymentProvider`
  (`src/lib/payments/`) elegible por configuración: `PAYMENT_PROVIDER`
  (`mercadopago` por defecto | `stripe`), con un indicador visible en el admin.
  El pedido guarda el proveedor y los ids de pago del proveedor. El código de
  Stripe existente se mueve detrás de la interfaz sin cambiar su comportamiento
  ni sus tests.
- La interfaz cubre: crear/actualizar el intento de pago de un pedido, procesar
  el pago, parsear y verificar el webhook en eventos normalizados (pagado,
  pendiente, fallido, reembolsado, contracargo), reembolsar (total o parcial) y
  mapear estados del proveedor a `OrderStatus`, más el componente cliente del
  paso Pago de cada proveedor.
- Se mantiene el flujo visible Envío → Pago → Revisar y **solo se cobra con
  "Realizar pedido"**. El servidor crea el pago de MP desde el `formData` del
  Brick con `X-Idempotency-Key`, el monto recalculado del pedido PENDING,
  `external_reference` = id del pedido y `notification_url` a nuestro webhook.
- Estados: `approved` → mismo camino de éxito que Stripe (stock atómico, PAID,
  carrito, email; sin stock → reembolso + CANCELLED). `in_process`/`pending`
  (incluye tickets en efectivo) → nuevo estado `PAYMENT_PENDING`, con
  instrucciones/enlace del ticket y vencimiento en la confirmación, en "Mis
  pedidos" y por email. `rejected` → el cliente sigue en el paso de pago con el
  motivo en castellano. `cancelled`/vencido → CANCELLED liberando reservas
  (stock/cupón). `refunded`/`charged_back` → se reflejan en el pedido.
- Webhook `/api/webhooks/mercadopago`: verifica `x-signature` (HMAC SHA256 con
  `MERCADOPAGO_WEBHOOK_SECRET` sobre el manifest
  `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), **consulta el pago a la
  API** (nunca confía en el cuerpo) y es idempotente y seguro ante reintentos y
  eventos fuera de orden.
- Admin: los reembolsos van por el proveedor del pedido (cancelar un PAID
  reembolsa todo, como hoy); el detalle muestra proveedor, id de pago, medio,
  cuotas e historial de estados.
- Env: `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`,
  `MERCADOPAGO_WEBHOOK_SECRET`, `PAYMENT_PROVIDER`. Sin credenciales, en dev se
  muestra "Pagos no configurados"; los tests usan un proveedor simulado en el
  borde del proveedor (nunca activo en un build de producción) con
  notificaciones firmadas de test. Credenciales de prueba de MP opcionales.

### Cupones

- Porcentaje o monto fijo; compra mínima; vencimiento; límite de usos total y
  por usuario; activo/inactivo; contador de usos.
- Campo de cupón en el carrito y en el checkout, **validado en el servidor**; el
  descuento se guarda en el pedido (código y monto) y el uso se libera al
  cancelar el pedido.

### Admin completo

- **Usuarios**: lista, detalle con sus pedidos, cambio de rol y bloqueo.
- **Categorías y temas en la base** (imagen, orden), editables.
- **Subida de imágenes**: Vercel Blob en producción (`BLOB_READ_WRITE_TOKEN`),
  carpeta local (`public/uploads`, fuera de git) en dev/test.
- **Mensajes de contacto y suscriptores del newsletter** persistidos, con
  bandeja en el admin y export CSV.
- **Configuración de la tienda**: costo de envío, umbral de envío gratis, barra
  de anuncio, destacados de la home.
- **Contenido editable** de las páginas informativas (FAQ, envíos,
  devoluciones…).
- **Dashboard con gráficos** (ventas por día, productos más vendidos) y export
  CSV de pedidos.
- **Audit log** general: quién hizo qué y cuándo, para toda mutación del admin.
  Cada mutación del admin: `requireAdmin` + entrada de auditoría + revalidar los
  tags/rutas de caché afectados.

### Pendientes del frontend que entran en esta etapa

- `sitemap.ts` + `robots.ts`.
- `CONTACT_TOPICS` / `CONTACT_MESSAGE_MAX` duplicados: una sola fuente.
- Mensajes de los guardrails de ESLint en tuteo.
- `.env.example` completo.
- CI también en push a ramas feature si conviene.

### Documentación y cierre

- Documentación del backend al final: modelo de datos, auth/roles,
  checkout/pagos (MP + Stripe, webhooks), admin, deploy (Vercel + Neon + MP/Stripe
  + Resend + Blob) y referencia de variables de entorno.
- Después: verificación propia, push de `feat/backend` y PR #2 con base
  `feat/ui-overhaul`.

## Notas de implementación: pagos (Mercado Pago + Stripe)

Decisiones tomadas al construir la etapa de pagos de la ampliación (docs/payments.md
tiene el detalle):

- *Interfaz*: `PaymentProvider` (`src/lib/payments/provider.ts`) cubre lo que es
  común después de cobrar: cancelar un pago no acreditado, reembolsar (total o
  parcial, idempotente), buscar un reembolso, verificar webhooks y traducirlos a
  eventos normalizados, mapear estados. Crear el intento y procesar el pago quedan
  en un flujo de checkout por proveedor (`orders/checkout.ts` para Stripe, sin
  cambios de comportamiento; `orders/mercadopago.ts`), porque lo que el navegador
  recolecta es distinto (ConfirmationToken vs. formData del Brick). Admin,
  limpieza y webhooks usan la interfaz.
- *Diferir el cobro con el Brick*: el Payment Brick se monta con
  `hidePaymentButton` y "Revisar pedido" lee el formulario con
  `paymentBrickController.getFormData()`; el pago se crea en "Realizar pedido". El
  token de tarjeta es de un solo uso: tras un rechazo hay que volver a ingresarla
  (como con Stripe). No se pudo verificar contra credenciales reales en esta etapa
  (no hay cuentas): el modo simulado reemplaza al Brick en los tests.
- *Dinero en cuenta*: la opción `mercadoPago` del Brick exige una preferencia antes
  de que exista el pedido y redirige desde el paso Pago, así que "Cuenta de
  Mercado Pago" es una opción propia del paso Pago y "Realizar pedido" crea la
  preferencia de Checkout Pro (por el total del pedido, reutilizada mientras no
  cambie) y redirige; la vuelta (`/checkout/pedido/<id>`) consulta el pago. Si el
  cliente vuelve a "Revisar" (cambió el carrito), la preferencia anterior se cierra
  en Mercado Pago; un pago suyo que llegue igual por otro monto mientras el pedido
  sigue PENDING se reembolsa solo y el pedido no se toca (`amount_mismatch` queda
  para el pago pendiente del propio pedido acreditado por otro monto).
- *Estados*: `PAYMENT_PENDING` nuevo. Mientras un pago está pendiente no se
  reserva stock (se toma al acreditarse, como con Stripe; si falta, se reembolsa).
  Rechazado con el cliente en el checkout → sigue PENDING; rechazado después de
  una revisión → CANCELLED (`payment_rejected`). Contracargo → CANCELLED
  (`chargeback`) con el stock devuelto. Contracargo que la tienda gana
  (`charged_back`/`reimbursed`, estado normalizado `chargeback_reversed`) → solo
  se registra (estado del pago e historial, aviso en el admin): no se reembolsa
  (Mercado Pago no reembolsa un pago con contracargo) y el pedido no cambia.
  La limpieza diaria también aplica los pagos que terminaron sin aviso
  (ticket vencido, tarjeta rechazada tras revisión): el pedido registra el
  estado y el cliente recibe el email.
- *Transiciones*: no hay una tabla estado de pago → estado de pedido; cada flujo
  las decide bajo el lock del pedido según dónde está (`applyLocked` en
  `src/lib/orders/mercadopago.ts`, `src/lib/orders/webhook.ts` para Stripe). La
  clave de idempotencia del reembolso de un pedido es una sola
  (`orderRefundKey`), la usen el admin, el webhook o el proveedor que sea.
- *Idempotencia*: `PaymentEvent` (clave única proveedor:pago:estado:detalle) es a
  la vez el historial del pago que ve el admin y el registro de qué noticias ya
  se aplicaron. El webhook siempre lee el pago de la API, así que aplica el estado
  actual y nunca uno viejo.
- *Columnas*: Stripe conserva `stripePaymentIntentId`/`stripeRefundId`; Mercado
  Pago usa `providerPaymentId`/`providerRefundId` y los campos de medio, cuotas,
  ticket y estado. `paymentProvider` tiene default `STRIPE` en la base (los
  pedidos anteriores); la app lo fija siempre al crear.
- *Tests sin cuentas*: `PAYMENTS_MOCK=1` (alias del anterior `STRIPE_MOCK=1`)
  activa los dos proveedores simulados. En ese modo una cookie de prueba elige el
  proveedor por navegador (así un mismo servidor e2e corre el checkout de Mercado
  Pago y el de Stripe) y `/api/test/mercadopago` hace lo que Mercado Pago haría
  solo; fuera de él ambos se ignoran (404). Los tests de integración de Stripe
  corren con `PAYMENT_PROVIDER=stripe`.
- *Local*: Mercado Pago no notifica a `localhost`; `notification_url` solo se
  manda con un `NEXT_PUBLIC_SITE_URL` https.

## Notas de implementación: cupones

Decisiones tomadas al construir la etapa (docs/payments.md, «Cupones en los totales», tiene el detalle):

- *Cuentas*: porcentaje redondeado al peso, mitad hacia arriba; monto fijo
  tope el subtotal; el envío nunca se descuenta y el envío gratis se decide
  con el subtotal antes del descuento (un cupón no hace volver el envío); si
  el cupón cubre todos los productos se cobra el envío (no hay pedidos de $0,
  que los proveedores no pueden cobrar). `orderTotals(lines, coupon)` en
  `src/lib/pricing.ts` es la única fuente: carrito, checkout, el pedido y el
  monto de Mercado Pago/Stripe.
- *Reserva atómica*: el pedido PENDING y la reserva del uso se escriben en la
  misma transacción, con la fila del cupón bloqueada. El límite total cuenta
  REDEEMED + las reservas con el pago enviado (ver «Verificación final»).
- *Reserva corta* (revisión de la etapa): «Revisar» reserva por 30 min
  (`holdExpiresAt`); al enviar el pago se vuelven a contar los límites con el
  cupón bloqueado y la reserva dura hasta que el pedido se resuelva. Sin esto,
  checkouts sin pagar (gratis y anónimos) retenían usos 24 h: alcanzaba con
  repetirlos para agotar un cupón limitado. Más un límite propio para preparar
  pedidos con cupón. Una reserva vencida es un uso nuevo: al pagar se revisan
  también activo y fechas.
- *Checkout Pro* (segunda revisión): el pago se hace en el sitio de Mercado
  Pago, así que la preferencia de un pedido con cupón vence con la reserva
  corta y el aviso del pago vuelve a controlar el cupón (fila bloqueada)
  antes de PAID/PAYMENT_PENDING; si ya no entra, se reembolsa (o se cancela
  el pago pendiente) y el pedido se cancela (`coupon_unavailable`). Se
  descartó retener el uso 24 h por preferencia: abrir Checkout Pro no cuesta
  nada y volvería a permitir agotar cupones con checkouts sin pagar.
- *Límite de consultas*: el presupuesto mayor de las re-consultas solo vale
  con un token HMAC (AUTH_SECRET) del código, que devuelve «Aplicar»; si no,
  cuenta como intento.
- *Por cliente*: la cuenta, en todos los pasos; el email (no verificado: lo
  escribe cualquiera) solo con usos pagados o con el pago enviado, y solo al
  pagar. Así nadie gasta el cupón de otra persona con checkouts a su nombre,
  y la consulta del carrito no revela si un email compró con un cupón.
- *El navegador vuelve a preguntar*: carrito y checkout consultan el cupón
  guardado al cargar (y al volver a la pestaña) y no muestran el descuento
  hasta la respuesta; el cupón guardado tiene dueño (como el carrito).
- *Liberar*: un trigger sobre `Order.status` (PAID → REDEEMED, CANCELLED →
  RELEASED) en vez de tocar cada camino de cancelación (limpieza, reemplazo,
  admin, rechazos, reembolsos, contracargos): ninguno puede olvidarse.
  PAYMENT_PENDING retiene la reserva (migración de la reserva corta).
- *Admin*: el código no se edita y los cupones no se borran (los pedidos los
  guardan); «Desactivar» corta los usos nuevos. `AuditLog` es la tabla de
  auditoría general (todas las mutaciones del admin salvo los cambios de
  estado de pedidos, que siguen en `OrderStatusChange`); la etapa de admin
  completo la usa para el resto.
- *Rutas*: el admin vive en `/admin/coupons` como las otras secciones
  (`/admin/products`, `/admin/orders`); `/admin/cupones` redirige ahí.

## Notas de implementación: admin (catálogo, usuarios, auditoría)

Decisiones tomadas al construir la etapa (docs/admin.md y docs/backend.md,
«Subidas de imágenes», tienen el detalle). Reemplazan a las notas anteriores
"Imágenes: solo URLs" y "Auditoría: solo `OrderStatusChange`".

- *Auditoría general*: `AuditLog` (admin, acción `<entidad>.<verbo>`, entidad e
  id, `{campo: [antes, después]}` o lo guardado al crear/borrar, IP, fecha) en
  la misma transacción que cada mutación del admin: productos, stock, archivo,
  pedidos, moderación de reseñas, cupones, usuarios, categorías, temas y
  subidas. La IP es solo la que `client-ip.ts` confía (sin proxy confiable,
  vacía). `/admin/audit` filtra por admin, tipo, registro y fechas; cada
  detalle tiene su panel de historial. `OrderStatusChange` se mantiene para la
  línea de tiempo del pedido.
- *Usuarios*: `User.blockedAt` / `blockedReason`. Bloquear sube
  `sessionVersion` (las sesiones JWT existentes dejan de valer) y rechaza el
  login con contraseña (el motivo solo después de la contraseña correcta, para
  no revelar el estado de una cuenta ajena) y con Google. Reglas: nadie cambia
  su propio rol ni se bloquea; el último admin activo no se degrada ni se
  bloquea, con las filas ADMIN bloqueadas en la transacción para que dos
  cambios simultáneos no dejen la tienda sin admin.
- *Temas*: tabla `Theme` (nombre único sin mayúsculas/acentos, slug, orden,
  visible) y `Product.themeId`. La migración crea un tema por valor distinto
  con el mismo nombre, así que las URLs y filtros por nombre siguen igual; el
  filtro también acepta el slug. Los enlaces del menú pasan de `/search?q=` a
  `/search?theme=<slug>` (más preciso que una búsqueda de texto, y estable si se
  renombra el tema); los valores del filtro también son el slug y los chips
  muestran el nombre. Visible = en el menú
  y en la lista del filtro; un tema oculto sigue en sus productos.
- *Categorías*: el slug sigue siendo `Category.id` (no se cambió la clave:
  todo el catálogo y las URLs la usan). Cambiarlo es un `UPDATE` de la clave
  con `ON UPDATE CASCADE` y una fila `CategoryRedirect` con el slug viejo (308
  desde `proxy.ts`); el historial se busca bajo todos los slugs de la
  categoría, y un slug viejo no se reutiliza. Oculta = fuera de navegación,
  home y filtros, página 404; sus productos se siguen vendiendo.
- *Orden*: "Subir" / "Bajar" (accesible con teclado, sin arrastrar), con
  posiciones renumeradas en cada movimiento. El botón no se desactiva mientras
  espera (`aria-disabled`, para no perder el foco); al terminar el foco queda
  en él o en el otro si la fila llegó a un extremo, y se anuncia el lugar
  nuevo. La galería del producto hace lo mismo con sus controles, y un texto
  alternativo faltante marca ese campo (`aria-invalid`) y recibe el foco.
- *Galería del editor*: parte de la misma lista que muestra la tienda (`img`
  primero aunque no esté en `images`), para que guardar no pierda la imagen
  principal.
- *Imágenes*: subida por Route Handler (progreso con XHR; las Server Actions
  limitan el cuerpo a 1 MB). Validación por bytes mágicos, límite de tamaño y
  de píxeles, re-codificación con sharp a WebP (un archivo de hasta 1600 px; sin miniatura guardada, next/image
  ya sirve tamaños menores), nombres
  aleatorios. Vercel Blob con `BLOB_READ_WRITE_TOKEN`, si no `public/uploads`
  servido también por una ruta para `next start`. Las URL siguen como opción.
  Galería con texto alternativo obligatorio por imagen (`Product.imageAlts`) y
  categorías con `imageAlt`.

## Notas de implementación: admin de la tienda (configuración, contenido, bandeja, dashboard, exports)

Decisiones tomadas al construir la etapa (docs/admin.md y docs/backend.md,
«Detalle: configuración, contenido, contacto y newsletter», tienen el detalle):

- *Configuración*: `StoreSettings` es una fila (id 1, check) y la app cae en
  `DEFAULT_STORE_SETTINGS` mientras falta. Las páginas la leen con el tag
  `settings`; **el precio de un pedido sale de la fila leída en la
  transacción**, no de la caché. `lib/pricing` toma la regla de envío como
  argumento (sin constantes; el default queda para seed y tests). El costo de
  envío es > 0 (check): con un cupón que cubre todo y envío $0 el pedido
  costaría $0, que los proveedores no cobran; envío gratis siempre = umbral $1.
  La barra de anuncio guarda un tono (par de tokens), nunca un color.
- *Marcadores* (`{{costo_envio}}`…) en la barra y el contenido: así una cifra
  de la configuración no queda vieja escrita en un texto.
- *Contenido*: documento JSON (título, introducción, bloques markdown / faq /
  list) en `ContentPage.draft` y `.published`, validado al escribir y al leer
  (una fila inválida es "sin contenido": 404, nunca a medias). Markdown con
  react-markdown sin HTML crudo ni imágenes, enlaces filtrados. Se descartó un
  editor de HTML/rich text: más superficie de inyección y otra dependencia
  pesada en el admin. Lo que cada página agrega por su cuenta sigue en código.
  Las páginas renderizan por request (el layout lee la sesión), así que "estática
  con revalidación" es el data cache con el tag `content:<slug>`, que "Publicar"
  expira.
- *Contacto y newsletter*: rate limit por IP (y por email el contacto), campo
  trampa, aviso a `STORE_NOTIFY_EMAIL` o al email de contacto. Token de baja =
  id del suscriptor + HMAC-SHA256 con `AUTH_SECRET` (nada guardado; se rearma
  para cualquier envío y para la columna "Enlace de baja" del CSV; sobrevive a
  una re-suscripción); baja solo por POST (botón), nunca por GET, y "Dar de
  baja" auditado en `/admin/newsletter`. Suscribirse otra vez contesta igual
  (un texto cierto en todos los casos) y no manda nada. Un email dado de baja no
  se reactiva desde el formulario público: recibe un email de confirmación
  (token propio, sha256 en `resubscribeTokenHash`, 7 días, uno por día) y
  vuelve solo con el botón de `/newsletter/confirmar`. Un email nuevo no tiene
  doble opt-in: cualquiera puede suscribir uno ajeno (recibe la bienvenida con
  el enlace de baja); queda como pendiente. Sin Resend, en producción los
  emails no se vuelcan a la consola (solo asunto y destinatario enmascarado).
- *Dashboard*: ingresos = PAID + SHIPPED + DELIVERED por día de pago en hora de
  Argentina; conversión = checkouts iniciados (pedidos creados) que terminaron
  cobrados, porque no hay analítica de visitas. Gráficos en HTML sobre tokens con
  d3-scale para el eje (sin librería de charts pesada ni JS en el cliente), con
  resumen y tabla de datos.
- *Exportaciones*: `;` + BOM para Excel en español, comillas RFC 4180,
  apóstrofo ante `= + - @ tab CR`, streaming por lotes, auditadas con filtros y
  filas.

## Notas de implementación: documentación y cierre

- *Documentación*: el detalle que vivía en el README pasó a `docs/`:
  `backend.md` (arquitectura del servidor y los detalles de sesión, listas y
  bandeja), `data-model.md` (tablas, reglas y máquinas de estado en mermaid),
  `payments.md`, `admin.md` y `deploy.md` (con la referencia de variables). El
  README queda como resumen, inicio rápido y enlaces. Las guías de arquitectura,
  tests y contribución de la rama de UI se trajeron y se actualizaron para el
  backend.
- *Sitemap y robots*: `/sitemap.xml` sale de la base (inicio, categorías
  visibles, productos a la venta, páginas informativas con contenido publicado
  válido) con la fecha de cada cambio, cacheado bajo los tags `products`,
  `categories` y `content:<slug>` más una revalidación de 1 h. `/robots.txt`
  excluye `/admin`, `/account`, `/checkout`, `/newsletter/` y `/api/`; las demás
  páginas `noindex` (carrito, búsqueda, login…) siguen rastreables para que los
  buscadores lean su `noindex`, y un test garantiza que ninguna entra al sitemap.

## Notas de implementación: verificación final

Lo que cambió después de la verificación propia (todos con tests):

- *Cupones*: el límite total cuenta solo usos comprometidos (`REDEEMED`, o
  `RESERVED` con el pago enviado: `holdExpiresAt` null). La reserva corta de
  «Revisar» ya no ocupa un uso del total: cualquiera puede preparar pedidos sin
  cuenta (cada «Revisar» sin cookie crea uno), y con el rate limit por IP un
  script podía tener agotado un cupón chico para siempre. Cuando quedan pocos
  usos los gana quien paga primero (se controla con el cupón bloqueado al enviar
  el pago). La reserva corta sigue contando para el límite de la propia cuenta.
  El admin muestra aparte los usos con el pago enviado.
- *Reseñas*: la Server Action de la ficha borra solo las reseñas propias (también
  para un admin); borrar la de otra persona es solo moderación desde el admin y
  siempre deja su `review.delete` en la auditoría (`deleteReview` recibe un autor
  o un moderador).
- *Webhooks*: Mercado Pago verifica `x-signature` antes de leer el cuerpo (la
  firma no lo cubre) y lo lee con tope (64 KB); Stripe, con tope de 512 KB. Las
  subidas usan el mismo lector con contador.
- *Imágenes*: `next/image` y las URLs del admin aceptan solo `uploads/` del store
  de Blob de la tienda (host derivado del token o `BLOB_PUBLIC_HOSTNAME`), no
  `*.public.blob.vercel-storage.com`: el comodín convertía el optimizador en un
  proxy de cualquier store ajeno.
- *Admin*: export CSV de la bandeja de mensajes (`export.messages`); los paneles
  de historial muestran los 8 cambios más recientes con «Ver todo», con un solo
  título y texto vacío; el pedido tiene una sola línea de tiempo (sus entradas de
  auditoría eran los mismos cambios de estado).
- *Checkout*: un pedido que ya no está PENDING pasa a `/checkout/pedido/<id>`
  (recargar no lleva a un carrito vacío) y el email «espera el pago» de un
  invitado enlaza esa página (abre solo en su navegador). Sin credenciales de
  pago, el carrito y el paso Envío lo dicen y no dejan seguir.
- *Pruebas y CI*: el setup de Playwright reutiliza solo el `next dev` de esta
  copia y su base (hash de carpeta + `DATABASE_URL`); 4 workers locales; esperas
  de rutas frías en los specs que fallaban bajo carga. CI corre también en
  `feat/**` y en PRs hacia esas ramas, así un PR apilado tiene CI.
- *Migraciones*: las carpetas llegan hasta `20261019070000_…`, adelantadas al
  reloj; CONTRIBUTING explica cómo nombrar la próxima a mano.

Decisiones explícitas (no son pendientes):

- *Status Screen Brick*: no se usa. La confirmación propia sirve a los dos
  proveedores, sigue el pedido (no solo el pago) y respeta el sistema de diseño.
- *Proveedor de pagos*: se elige por entorno (`PAYMENT_PROVIDER`) con el
  indicador del resumen del admin; no hay setting en `/admin/configuracion`.
  Cambiar de proveedor implica credenciales y webhooks nuevos, así que es una
  decisión de deploy, no un interruptor del panel.
- *Mercado Pago real*: el camino del Payment Brick (`hidePaymentButton` +
  `getFormData`) y Checkout Pro solo corrieron contra el mock; falta una corrida
  con credenciales de prueba (docs/payments.md, «Probar con credenciales de
  prueba de Mercado Pago») antes de producción.
- *Ruido conocido*: `next dev` puede registrar `uncaughtException: Error:
  aborted` cuando un spec cierra el navegador con un pedido en curso. Se vio una
  vez (y otra en la corrida de store-ops de la segunda verificación, sin tests
  fallidos) y no se reprodujo; los handlers de la tienda que leen cuerpos a mano
  (subidas, webhooks y los JSON del checkout) capturan el corte, así que lo más probable es que venga del
  manejo de cuerpos de Next en desarrollo (sin confirmar). `npm audit` informa `braces` (alta) solo en dependencias de
  desarrollo, vía `eslint-config-next`; producción queda limpia.

## Notas de implementación: verificación final, segunda ronda

- *Cupones y pagos sin pagar*: un ticket de efectivo (Rapipago, Pago Fácil)
  enviado y no pagado, o un pago de Stripe esperando 3D Secure, ya no ocupa un
  uso del límite total ni del límite por email. Imprimir un ticket no cuesta
  nada y vence en días: alcanzaba con dos requests por pedido para agotar un
  cupón chico, o para gastar el `maxPerUser` de otra persona usando su email.
  Ahora esos pedidos guardan el uso con una reserva que dura mientras el pago
  puede llegar (`holdCouponUntilPaid`: vencimiento del ticket + 1 día de gracia;
  30 min para 3D Secure), que solo cuenta para la propia cuenta. Al acreditarse,
  el cupón se vuelve a controlar con su fila bloqueada; si ya no entra, se
  reembolsa y el pedido se cancela (`coupon_unavailable`), igual que Checkout
  Pro. Una tarjeta en revisión sí ocupa el uso (hubo una autorización real).
- *Cuerpos del checkout*: los JSON de `/api/checkout/coupon`, `/orders`,
  `/orders/<id>/pay` y `/sync` se leen con tope de 64 KB antes de validar o
  consumir el rate limit (413 si se pasa), como los webhooks.
- *Códigos de cupón*: un cupón desactivado o que todavía no empezó responde igual
  que uno inexistente («Ese código no es válido») salvo que el navegador mande el
  token de una cotización aceptada de ese código (`recheckToken` en la consulta,
  `couponToken` al preparar el pedido). Así probar nombres no revela qué cupones
  existen ni cuándo empieza una promoción.
- *Historial del pago*: el reembolso de un admin en Mercado Pago queda en el
  historial del pago en el momento (fuente «panel»); la notificación posterior
  es la misma entrada.
- *Admin*: el aviso de una acción confirmada (bloquear, cancelar…) aparece
  cuando la página ya muestra el cambio.
- Sin cambios: el formulario de registro vacía las contraseñas tras un error del
  servidor (nunca las devuelve); docs/testing.md explica cómo limpiar
  `RateLimit` en dev. El error de hidratación visto una vez en
  `/admin/mensajes` no se reprodujo.
