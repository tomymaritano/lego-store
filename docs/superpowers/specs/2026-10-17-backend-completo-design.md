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
  al registrarse). `/admin/*` y las acciones de admin protegidas por middleware +
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
- Desarrollo local de webhooks con Stripe CLI (`stripe listen`), documentado en README.

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
  enviarse (dev, tests, CI). README explica que sin dominio verificado Resend solo
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
