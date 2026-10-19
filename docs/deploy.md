# Deploy

Cómo poner la tienda en producción: **Vercel** + **Neon** (o cualquier
PostgreSQL) + **Mercado Pago** (+ **Stripe** opcional) + **Resend** + **Vercel
Blob**. Al final: la referencia de variables de entorno y una checklist para
después del deploy.

## Piezas

| Pieza | Para qué | ¿Obligatoria? |
| --- | --- | --- |
| Vercel (u otro hosting de Next.js 16 con Node ≥ 22.13) | La app, el Cron de la limpieza | sí (o un servidor propio, ver [Fuera de Vercel](#fuera-de-vercel)) |
| PostgreSQL (Neon, Supabase, RDS, el tuyo…) | Todos los datos, el rate limiting | sí; el build también la lee |
| Mercado Pago | Cobrar (proveedor por defecto) | sí, salvo que uses Stripe |
| Stripe | Proveedor alternativo, o reembolsos de pedidos viejos de Stripe | no |
| Resend | Enviar emails | no (sin él, en producción no se manda ningún email) |
| Vercel Blob | Guardar las imágenes subidas desde el admin | no (sin él, en Vercel el admin pega URLs) |

## 1. Base de datos (Neon)

1. Crea un proyecto en [Neon](https://neon.tech) (región cercana a la de Vercel)
   y copia dos cadenas de conexión: la **con pooling** (host con `-pooler`) para la
   app y la **directa** para las migraciones. Las dos con `?sslmode=require`.
2. Aplica las migraciones y el seed **contra la conexión directa**, desde tu
   máquina o desde CI:

   ```bash
   DATABASE_URL="postgresql://…directa…?sslmode=require" \
   ADMIN_EMAIL="tu@email.com" ADMIN_PASSWORD="una-contraseña-larga" \
   sh -c 'npm run db:deploy && npm run db:seed'
   ```

   El seed carga el catálogo, los cupones de ejemplo, la configuración y el
   contenido de las páginas (solo si faltan) y crea el admin. Es idempotente,
   pero **vuelve el catálogo del seed a sus valores (stock incluido)**: en
   producción córrelo solo la primera vez.
3. En Vercel, `DATABASE_URL` es la cadena **con pooling**.

Con otro Postgres: lo mismo, una sola URL si no hay pooler. Postgres 17 es lo que
usan el desarrollo y CI.

## 2. Proyecto en Vercel

1. Importa el repo. Framework: Next.js; build `npm run build`; Node 22.
2. Variables (ver la [referencia](#variables-de-entorno)): como mínimo
   `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL` (el dominio con
   `https://`), `CRON_SECRET` y las de Mercado Pago. `NEXT_PUBLIC_*` se fijan al
   compilar: si cambian, vuelve a desplegar.
3. **El build necesita la base**: lee las categorías y los ids de las rutas, y el
   sitemap.
4. **Migraciones en cada deploy**: aplica `npm run db:deploy` contra la conexión
   directa **antes** de desplegar un commit que trae migraciones nuevas (desde CI o
   tu máquina). Si prefieres que lo haga Vercel, el comando de build puede ser
   `npm run db:deploy && npm run build` con una `DATABASE_URL` que admita
   migraciones (la directa). `migrate deploy` solo aplica lo pendiente y nunca
   borra datos; nunca uses `migrate dev` ni `migrate reset` contra producción.
5. **Cron**: `vercel.json` agenda `GET /api/cron/expire-orders` todos los días a
   las 4 UTC; Vercel manda `Authorization: Bearer $CRON_SECRET` solo. Sin
   `CRON_SECRET` la ruta responde 503 y los pedidos pendientes no se limpian.
6. En Vercel no hace falta `AUTH_TRUST_HOST` ni `TRUSTED_PROXY_HOPS`: Auth.js
   confía en el host y la IP del cliente sale de los headers de Vercel.

## 3. Mercado Pago

1. En [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app),
   tu aplicación → **Credenciales de producción**: *Access Token* →
   `MERCADOPAGO_ACCESS_TOKEN`, *Public Key* → `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`.
2. **Webhooks > Configurar notificaciones**, modo producción: URL
   `https://<tu-dominio>/api/webhooks/mercadopago`, evento **Pagos**. Guardar
   genera la clave secreta → `MERCADOPAGO_WEBHOOK_SECRET`.
3. `NEXT_PUBLIC_SITE_URL` con tu dominio `https`: es adonde vuelve Checkout Pro y
   lo que va en el `notification_url` de cada pago.
4. Deja `PAYMENT_PROVIDER` vacío o en `mercadopago`.

Detalle del flujo y cómo probar en [payments.md](./payments.md).

## 4. Stripe (opcional)

Para cobrar con Stripe (`PAYMENT_PROVIDER=stripe`) o para poder reembolsar pedidos
que se cobraron con Stripe:

1. `STRIPE_SECRET_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Un endpoint de webhook en el dashboard de Stripe:
   `https://<tu-dominio>/api/stripe/webhook`, eventos
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `payment_intent.canceled` y `charge.refunded`. Su signing secret →
   `STRIPE_WEBHOOK_SECRET`.

## 5. Resend (emails)

1. Verifica tu dominio en [Resend](https://resend.com) (sin dominio verificado,
   Resend solo entrega al dueño de la cuenta).
2. `RESEND_API_KEY` y `EMAIL_FROM` (por ejemplo `LEGO Store <pedidos@tu-dominio.com>`).
3. Opcional: `STORE_NOTIFY_EMAIL` para los avisos de mensajes de contacto (si no,
   van al email de contacto de `/admin/configuracion`).

Sin Resend, un servidor de producción no manda ni muestra los emails: solo deja
en el log el asunto y el destinatario enmascarado.

## 6. Vercel Blob (imágenes del admin)

1. En el proyecto de Vercel, **Storage → Blob → Create** y conéctalo: Vercel
   agrega `BLOB_READ_WRITE_TOKEN`.
2. Las subidas se guardan públicas bajo `uploads/` y se sirven desde
   `<id del store>.public.blob.vercel-storage.com`. `next.config.mjs` permite para
   `next/image` **solo ese host y esa carpeta**: lo saca del id del store que
   trae `BLOB_READ_WRITE_TOKEN` (o de `BLOB_PUBLIC_HOSTNAME`, si lo defines) al
   compilar. Un comodín sobre todos los stores de Blob haría que `/_next/image`
   descargue y sirva imágenes de stores ajenos con la cuota de la tienda. Si
   cambias de store, vuelve a desplegar.

Sin el token, en Vercel el admin no puede subir (el disco es de solo lectura) y
pega URLs. Este camino no se probó con un token real: verifícalo con una subida
después del primer deploy.

## Fuera de Vercel

- `next build` + `next start` detrás de un reverse proxy con HTTPS.
- **`AUTH_TRUST_HOST=true`** (o `AUTH_URL` con la URL pública): fuera de Vercel
  Auth.js no confía en el header `Host` si no se lo dices.
- **Cron**: cualquier scheduler que haga
  `curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/expire-orders`
  una vez por día.
- **Subidas**: sin `BLOB_READ_WRITE_TOKEN` se guardan en `public/uploads` (o
  `UPLOADS_DIR`) del servidor: ese disco tiene que persistir entre deploys y ser el
  mismo para todas las instancias.

### TRUSTED_PROXY_HOPS

Los límites por IP (login, registro, checkout, contacto…) necesitan la IP real
del cliente, y `X-Forwarded-For` lo puede inventar cualquiera. Con
`TRUSTED_PROXY_HOPS=N` la app toma la entrada de `X-Forwarded-For` que agregó el
proxy más externo, contando N desde la derecha (por ejemplo `1` con un solo nginx
que agrega la IP del cliente). Sin esa variable (y sin `VERCEL=1`) no confía en
ninguna IP: **todos los visitantes comparten los límites por IP**, y una sola
persona puede bloquear el login desde navegadores nuevos, el registro y el
checkout de invitado para todos. El servidor lo avisa en el log al arrancar
(`src/instrumentation.ts`) pero arranca igual.

### Caché si te alojas en tu propio servidor

El catálogo, la configuración y el contenido salen del data cache de Next, y las
escrituras lo invalidan con `revalidateTag` / `updateTag`. En Vercel eso vale para
todas las instancias; en un servidor propio **solo llega a la instancia que lo
ejecutó**. Con varias instancias, las demás mostrarían precio, stock y fichas
viejos hasta 1 h. Opciones: una sola instancia, o un `cacheHandler` compartido
(por ejemplo sobre Redis) en `next.config.mjs`. El checkout no se ve afectado:
siempre recalcula precios, stock y cupón desde Postgres.

## Variables de entorno

`.env.example` las tiene todas, agrupadas y comentadas. En desarrollo van en
`.env.local` (fuera de git).

| Variable | ¿Obligatoria? | Dónde se usa | Ejemplo |
| --- | --- | --- | --- |
| `DATABASE_URL` | sí | Prisma (`src/lib/db`, `prisma.config.ts`), el build, el seed | `postgresql://lego:lego@localhost:5433/lego_store` |
| `DATABASE_URL_TEST` | solo para tests | Proyecto `integration` de Vitest (su nombre tiene que contener "test"; se vacía en cada corrida) | `postgresql://lego:lego@localhost:5433/lego_store_test` |
| `AUTH_SECRET` | sí | Auth.js (firma de sesiones), dispositivo conocido, token de re-consulta de cupones, enlaces de baja del newsletter | 32 bytes aleatorios en base64url |
| `AUTH_TRUST_HOST` | fuera de Vercel | Auth.js | `true` |
| `AUTH_URL` | no | Auth.js (URL pública, alternativa a `AUTH_TRUST_HOST`) | `https://tienda.example` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | Ingreso con Google (el botón aparece con las dos) | — |
| `TRUSTED_PROXY_HOPS` | fuera de Vercel | `src/lib/rate-limit/client-ip.ts` | `1` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | para crear el admin | Seed; el registro rechaza `ADMIN_EMAIL`; Google con ese email verificado da ADMIN | `admin@tienda.example` / ≥ 8 caracteres |
| `SEED_DEV_ADMIN` | no (solo desarrollo) | Seed: crea `admin@lego-store.local` / `admin-dev-1234`; ignorada con `NODE_ENV=production` | `1` |
| `PAYMENT_PROVIDER` | no | Proveedor de los pedidos nuevos (`src/lib/payments/config.ts`) | `mercadopago` (default) o `stripe` |
| `MERCADOPAGO_ACCESS_TOKEN` | con Mercado Pago | SDK de Node (pagos, preferencias, reembolsos) | `APP_USR-…` (prueba: `TEST-…`) |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | con Mercado Pago | Payment Brick (navegador) | `APP_USR-…` |
| `MERCADOPAGO_WEBHOOK_SECRET` | con Mercado Pago | Firma `x-signature` del webhook | clave secreta de Webhooks |
| `STRIPE_SECRET_KEY` | con Stripe | Pasarela de Stripe | `sk_live_…` / `sk_test_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | con Stripe | Payment Element (navegador) | `pk_live_…` / `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | con Stripe | Firma del webhook | `whsec_…` |
| `PAYMENTS_MOCK` | nunca en producción | Proveedores simulados para tests y E2E (`STRIPE_MOCK`, nombre anterior) | `1` |
| `CRON_SECRET` | sí (para la limpieza) | `GET /api/cron/expire-orders` | 32 bytes aleatorios |
| `RESEND_API_KEY` / `EMAIL_FROM` | no | `src/lib/email/send.ts` | `re_…` / `LEGO Store <pedidos@tienda.example>` |
| `STORE_NOTIFY_EMAIL` | no | Avisos de mensajes de contacto | `tienda@tienda.example` |
| `BLOB_READ_WRITE_TOKEN` | no | Subidas a Vercel Blob | `vercel_blob_rw_…` |
| `BLOB_PUBLIC_HOSTNAME` | no | Host del store de Blob que aceptan `next/image` y las URLs del admin (por defecto, el del token; se lee al compilar) | `abc123.public.blob.vercel-storage.com` |
| `UPLOADS_DIR` | no | Carpeta de subidas locales (tests) | `/var/lego/uploads` |
| `NEXT_PUBLIC_SITE_URL` | sí en producción | URLs absolutas: canonical, Open Graph, sitemap, emails, `back_urls` y `notification_url` de Mercado Pago, retorno de Stripe | `https://tienda.example` |
| `POSTGRES_PORT` | no (Docker local) | `docker-compose.yml` | `5434` |
| `NEXT_DIST_DIR`, `E2E_DEV_PORT`, `E2E_PROD_PORT`, `BASE_URL` | no (herramientas) | Carpeta del build (Playwright), puertos de los E2E, origen de `npm run screenshots` | `.next-e2e`, `3010`, `3110` |

`VERCEL`, `NODE_ENV` y `CI` los pone la plataforma.

## Después del deploy

- [ ] `https://<dominio>/` carga con el catálogo; `/sitemap.xml` lista productos y
      categorías; `/robots.txt` apunta a ese sitemap.
- [ ] Ingresa con el admin del seed y entra a `/admin`; el resumen dice
      "Mercado Pago" en producción (o el modo que esperas).
- [ ] Ninguna advertencia al arrancar en el log (`PAYMENTS_MOCK`,
      `TRUSTED_PROXY_HOPS`).
- [ ] Una compra real de monto bajo con tarjeta: el pedido pasa a PAID, llega el
      email y aparece en "Mis pedidos"; en Tus integraciones > Webhooks la
      notificación figura entregada (200).
- [ ] Cancela esa compra desde el admin: el reembolso aparece en Mercado Pago y
      el stock vuelve.
- [ ] Un ticket de efectivo queda PAYMENT_PENDING con sus instrucciones.
- [ ] Si usas Stripe: el endpoint del webhook responde 200 a un evento de prueba.
- [ ] Sube una imagen desde un producto (Vercel Blob) y se ve en la tienda.
- [ ] El Cron figura en Vercel → Settings → Cron Jobs; una llamada sin
      `Authorization` a `/api/cron/expire-orders` responde 401.
- [ ] Cambia el costo de envío en `/admin/configuracion` y verifica que el carrito
      lo muestra.
