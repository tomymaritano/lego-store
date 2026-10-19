# Panel de admin

Qué hay en `/admin`, quién entra y qué hace cada acción, con sus efectos
(reembolsos, emails, caché, auditoría). La arquitectura de las piezas comunes
(sesión, caché, auditoría, subidas) está en [backend.md](./backend.md).

## Acceso y reglas comunes

- **Solo `ADMIN`**. `proxy.ts` manda a `/login` a quien llega sin sesión; cada
  página, cada lectura de `src/lib/admin/data.ts` y cada Server Action de
  `src/lib/admin/actions.ts` llama a `requireAdmin()` (o `requireAdminActor()`),
  con el rol leído de la base: un cliente recibe 403 y un admin degradado pierde
  el acceso en su siguiente pedido. Los Route Handlers del admin (subidas,
  exportaciones) usan `authorizeRequest({ admin: true })`.
- **Toda entrada pasa por zod** (`src/lib/validations/admin.ts` y vecinos). Los
  filtros de las listas son formularios GET (funcionan sin JavaScript) y un valor
  inválido en la URL cae en "sin filtro".
- **Toda mutación queda en `AuditLog`** en la misma transacción que el cambio
  (ver [Auditoría](#auditoría)).
- **Después de escribir**: las escrituras que ve la tienda expiran sus tags de
  caché (`updateCatalog`, `updateSettingsCache`, `updateContentCache`), las páginas
  del admin afectadas se revalidan (`revalidatePath`) y `refresh()` vuelve a
  renderizar la página actual. Las lecturas del admin van siempre directo a la
  base.
- **Concurrencia**: los cambios que dependen de lo que el admin vio (stock,
  estado del pedido) se escriben con compare-and-set o bajo bloqueo; si otro lo
  cambió en el medio, la acción lo dice y no pisa nada.
- **Rutas**: las secciones del panel base (productos, pedidos, reseñas, cupones,
  usuarios, categorías, temas, auditoría) viven en rutas en inglés, como el resto
  de la API; `/admin/cupones`, `/admin/categorias`, `/admin/temas`,
  `/admin/usuarios` y `/admin/auditoria` redirigen a ellas. Las que se sumaron con
  la extensión y no tienen equivalente en la tienda (`/admin/mensajes`,
  `/admin/contenido`, `/admin/configuracion`) quedaron en castellano, y
  `/admin/newsletter` se llama igual en los dos idiomas. Es una división a
  propósito (la tabla de abajo es la fuente): cambiarlas ahora solo
  sumaría redirecciones sin ganar nada para quien usa el panel.
- **Fechas**: numéricas con año y reloj de 24 h (`18/10/2026, 04:51`), en hora de
  Argentina.

## Secciones

| Sección | Ruta | Para qué |
| --- | --- | --- |
| Resumen | `/admin` | Lo que necesita atención y las métricas de un período |
| Productos | `/admin/products` | Catálogo, stock, archivo |
| Categorías | `/admin/categories` | Navegación, slugs, visibilidad |
| Temas | `/admin/themes` | Menú "Temas" y filtro |
| Pedidos | `/admin/orders` | Envío, entrega, cancelación con reembolso |
| Reseñas | `/admin/reviews` | Moderación |
| Cupones | `/admin/coupons` | Descuentos |
| Usuarios | `/admin/users` | Roles y bloqueo |
| Mensajes | `/admin/mensajes` | Bandeja del formulario de contacto |
| Newsletter | `/admin/newsletter` | Suscriptores |
| Contenido | `/admin/contenido` | Páginas informativas |
| Configuración | `/admin/configuracion` | Envío, anuncio, contacto, destacados |
| Auditoría | `/admin/audit` | Historial de todo lo anterior |

### Resumen

`src/lib/admin/dashboard.ts` y `report.ts`. Solo lectura.

- **Atención**: ingresos de hoy, 7 y 30 días; pedidos de hoy; por enviar; pagos
  pendientes; stock bajo (≤ 5) con edición en línea; mensajes nuevos; un aviso si
  hubo pedidos cancelados por `amount_mismatch` en los últimos 7 días; quién cobra
  los pedidos nuevos y en qué modo (producción, prueba, simulado, sin configurar).
- **Período** (`?from=&to=`, días de Argentina; 30 por defecto, atajos de 7/30/90,
  máximo 366): ingresos, pedidos pagados, ticket promedio, conversión (checkouts
  iniciados que terminaron pagados: no hay analítica de visitas), pedidos por
  estado y cuatro gráficos: ventas por día, productos más vendidos, ingresos por
  medio de pago y uso de cupones. Ingresos = PAID + SHIPPED + DELIVERED, por día
  de pago. Los gráficos son HTML renderizado en el servidor sobre los tokens
  (d3-scale solo calcula el eje), con una frase resumen y la tabla de datos.
- "Exportar CSV" de los pedidos del período.

### Productos

| Acción | Qué hace | Efectos |
| --- | --- | --- |
| Crear / editar | Todos los campos de la ficha; el tema se elige de `Theme`; galería ordenada con texto alternativo obligatorio por imagen, subida o por URL (`/images/…` o `https://www.lego.com/cdn/…`). | Recalcula las columnas de búsqueda; `updateCatalog` (`products`, `product:<id>`, `categories`); auditoría `product.create` / `product.update`. |
| Stock en línea | Lista y resumen. Compare-and-set: manda el stock que cargó; si una venta o un reembolso lo movió, se rechaza ("el stock cambió mientras editabas"). El formulario sin tocar Stock deja el stock como está. | `updateCatalog`; `product.stock`. |
| Archivar / restaurar | Archivado (`archivedAt`): fuera de toda lectura de la tienda (catálogo, búsqueda, ficha → 404, facetas, conteos), borra sus líneas de carritos y favoritos y no se puede agregar, reseñar ni comprar. Un PENDING que ya lo tenía se puede pagar igual. | `updateCatalog`; `product.archive` / `product.restore`. |
| Eliminar | Borra solo un producto que ningún pedido incluye (con sus reseñas); si hay pedidos, lo archiva. | `updateCatalog`; `product.delete` o `product.archive`. |

Filtros: búsqueda (la de la tienda o el id exacto), categoría, estado (en la
tienda / archivados), stock bajo o agotado; 20 por página.

### Categorías y temas

- **Categorías**: nombre, slug, descripción, imagen (subida o URL, texto
  alternativo obligatorio) y visible; "Subir" / "Bajar" con teclado (el foco se
  queda en el botón y una región `aria-live` anuncia el lugar). Oculta: sale de la
  navegación, la home y los filtros y su página da 404, pero sus productos se
  siguen vendiendo. **Cambiar el slug** mueve los productos (`ON UPDATE CASCADE`) y
  deja el viejo en `CategoryRedirect` (308 desde `proxy.ts`); otra categoría no
  puede tomar un slug viejo. Eliminar solo si ningún producto la usa (archivados
  incluidos). Efectos: `updateCatalog({ categories })`, revalida
  `/admin/categories` y `/admin/products`; auditoría `category.create`,
  `.update`, `.reorder`, `.delete`.
- **Temas**: nombre (único sin mayúsculas ni acentos), slug, visible y orden.
  Los enlaces y el filtro usan el slug (`/search?theme=star-wars`); `?theme=` sigue
  aceptando el nombre. Renombrar recalcula la búsqueda de sus productos. Eliminar
  solo si ningún producto lo usa. Efectos: `updateCatalog({ themes })`; auditoría
  `theme.*`.

### Pedidos

Lista de pedidos realizados (los que llegaron a "Realizar pedido"; los checkouts
sin intento de pago, con el filtro "Sin intento de pago"), filtros por estado
(más "Cancelados: monto distinto"), email o número (`LEGO-001001` / `1001`) y
fechas. El detalle muestra líneas, cliente, envío, medio de pago (proveedor,
tarjeta o medio, cuotas, id de pago, estado en el proveedor, ticket, reembolso),
la línea de tiempo, el historial del pago (`PaymentEvent`) y un solo "Historial"
de cambios del admin (`OrderStatusChange`: quién, cuándo y el reembolso; las
entradas de auditoría del pedido son esos mismos cambios de estado, así que no
se repiten en otro panel), con "Ver todo" en la auditoría.

Transiciones permitidas (`ADMIN_TRANSITIONS` en `src/lib/admin/format.ts`; la lógica en `src/lib/admin/orders.ts`):

| De → a | Qué pasa |
| --- | --- |
| PENDING / PAYMENT_PENDING → CANCELLED | Cancela el pago en el proveedor (el PaymentIntent de Stripe, el pago o ticket de Mercado Pago). Si el pago ya está en curso o acreditado, se rechaza y lo resuelve el webhook. |
| PAID → SHIPPED | Email "Tu pedido está en camino". No se puede si el pedido está retenido por un reembolso sin confirmar. |
| PAID → CANCELLED | Reembolso total por el proveedor del pedido + stock devuelto, en tres pasos (abajo). Email "Cancelamos tu pedido". |
| SHIPPED → DELIVERED | Solo marca la fecha. |

Cada cambio corre en una transacción que bloquea el pedido y comprueba el estado
que vio el admin (un doble clic o un segundo admin no hacen nada dos veces), y
queda en `OrderStatusChange` y en `AuditLog` (`order.ship`, `order.deliver`,
`order.cancel`, con el id del reembolso).

**Cancelar un pedido pagado**, para que ningún resultado de la llamada al
proveedor deje enviar un pedido ya reembolsado:

1. Retiene el pedido (`refundRequestedAt`, confirmado antes de llamar al
   proveedor): un pedido retenido no se puede enviar.
2. Pide el reembolso con la key del pedido (`order/<id>/refund`). Si la llamada
   falla, pregunta si el pago ya tiene un reembolso total (la respuesta se
   perdió): si lo tiene sigue con ese; si no, libera el pedido sin cambios; si el
   proveedor no responde, queda retenido hasta que el admin reintente.
3. Bajo el bloqueo, devuelve el stock y pasa a CANCELLED con el reembolso.
   `updateCatalog` de los productos repuestos.

Sin el proveedor del pedido configurado, "Cancelar" se muestra deshabilitado con
el motivo; enviar y entregar siguen disponibles. No hay acción para volver a
pagar un pedido cancelado (por ejemplo, tras ganar un contracargo).

### Reseñas

Todas, filtrables por producto, estrellas o texto. Eliminar recalcula el rating
del producto en la misma transacción; `updateCatalog` del producto; auditoría
`review.delete`. Sin el límite de ediciones de los clientes. Es el único camino
para borrar la reseña de otra persona: la acción de la ficha del producto borra
solo las propias, también para un admin, así que ninguna moderación queda sin
auditar.

### Cupones

Lista con estado (activo, programado, vencido, agotado, desactivado), usos contra
el límite (pagados más los que tienen el pago enviado y en curso; los checkouts
sin pagar y los tickets de efectivo que nadie pagó todavía se muestran aparte y
no ocupan usos), descuento otorgado y ventas de los pedidos
pagados que lo usaron. Un uso cuenta cuando se paga el pedido o se envía el pago
con tarjeta; un pedido sin pagar (un checkout o un ticket de efectivo) solo lo
reserva para su cliente. El detalle separa los usos «En curso»: con el pago
enviado (cuentan) y sin pagar (no cuentan), más los liberados por pedidos
cancelados. Crear y editar (tipo, valor, mínimo, fechas, límites,
descripción); **el código no cambia nunca y los cupones no se borran** (los
pedidos los guardan); "Desactivar" / "Activar" corta o habilita usos nuevos (los
pedidos que ya lo tienen lo conservan). El detalle muestra los usos con su pedido
(una reserva vencida se ve como "Reserva vencida") y el historial. Los cupones no
están en la caché del catálogo: se revalidan sus páginas del admin. Auditoría
`coupon.create`, `.update`, `.activate`, `.deactivate`.

### Usuarios

Lista con búsqueda por nombre o email, rol, estado y fecha de alta, con pedidos
realizados y lo gastado. El detalle muestra perfil, cómo ingresa, pedidos,
reseñas, direcciones de sus pedidos e historial.

- **Rol** USER / ADMIN y **bloquear / desbloquear** (con motivo opcional), con
  confirmación. Nadie cambia su propia cuenta y el último admin activo no se
  puede degradar ni bloquear (la escritura bloquea todas las filas ADMIN).
- Bloquear sube `sessionVersion` (sus sesiones terminan en el siguiente pedido) y
  marca `blockedAt`: el login con contraseña se rechaza (el motivo solo se dice
  tras la contraseña correcta) y el de Google termina en
  `/login?error=AccountBlocked`.
- Auditoría `user.role`, `user.block`, `user.unblock`.

### Mensajes

Bandeja de `ContactMessage` (nuevos y leídos; archivados aparte), con filtros por
motivo, texto y fechas. Marcar leído / no leído, archivar, volver a la bandeja y
"Responder por email" (un `mailto:` con el asunto y el mensaje citado).
"Exportar CSV" baja los mensajes de la vista y los filtros actuales. Auditoría
`message.read`, `.unread`, `.archive` (y `export.messages`); revalida la bandeja
y el resumen.

### Newsletter

Lista y búsqueda de suscriptores (activos y dados de baja), exportación CSV (con
la columna "Enlace de baja" para los activos) y "Dar de baja" para quien lo pide
por otra vía, con confirmación (auditoría `subscriber.unsubscribe`). No hay doble
opt-in para direcciones nuevas.

### Contenido

`/admin/contenido/<slug>` edita `/faq`, `/envios`, `/devoluciones`, `/nosotros`,
`/privacidad`, `/terminos` y la introducción de `/contacto`: título,
introducción y bloques ordenados (texto Markdown, grupos de preguntas
frecuentes, listas de pasos o tarjetas), con vista previa y orden con teclado.
El Markdown no admite HTML crudo ni imágenes y los enlaces se filtran.

| Acción | Efecto |
| --- | --- |
| Guardar borrador | La página no cambia; auditoría `content.draft`. |
| Publicar | Copia el borrador a `published`, expira `content:<slug>` y la ruta; auditoría `content.publish`. |
| Descartar borrador | Vuelve a lo publicado; auditoría `content.discard`. |

La barra de anuncio y el contenido aceptan marcadores (`{{costo_envio}}`,
`{{envio_gratis_desde}}`, `{{dias_devolucion}}`, `{{dias_entrega_min}}`,
`{{dias_entrega_max}}`, `{{tienda}}`, `{{email}}`, `{{telefono}}`,
`{{horario}}`) que se reemplazan al mostrar.

### Configuración

Cada sección se guarda sola (`StoreSettings`, auditoría `settings.<sección>`) y
expira el tag `settings`:

- **Envío**: costo y umbral de envío gratis (> 0). El servidor cotiza cada
  pedido con la regla leída en la misma transacción, así que rige desde el
  siguiente "Revisar".
- **Barra de anuncio**: texto, enlace (ruta del sitio o `https`), activa y tono
  (un par de tokens, nunca un color libre).
- **Contacto y redes**: email, teléfono, ubicación, horario y perfiles `https`.
- **Destacados de la home**: hasta 8 productos en orden (`FeaturedProduct`);
  un archivado deja de mostrarse. Auditoría `settings.featured`.

### Exportar CSV

Pedidos (una fila por línea), Usuarios, Newsletter y Mensajes tienen "Exportar
CSV" con los filtros de la lista:
`GET /api/admin/export/<orders|customers|newsletter|messages>`, solo
admins, en streaming por lotes. UTF-8 con BOM y `;` (lo que espera Excel en
español), comillas RFC 4180 y un apóstrofo delante de todo campo que una planilla
ejecutaría como fórmula (`=`, `+`, `-`, `@`, tab, CR). Cada exportación queda en la
auditoría (`export.<tipo>`) con sus filtros y lo que trae: `filas` en usuarios,
newsletter y mensajes; en pedidos, `pedidos` y `líneas` (una por producto), para
que cuadre con el archivo. Es un `GET` para que el navegador lo descargue, así
que rechaza con 403, antes de leer o auditar nada, un pedido que el navegador
marca como de otro sitio (`Sec-Fetch-Site` distinto de `same-origin` o `none`):
otro sitio no puede llenar la auditoría de exportaciones falsas con un enlace.

### Subir imágenes

Desde el formulario de producto y de categoría (`POST /api/admin/uploads`):
JPEG, PNG, WebP o AVIF hasta 8 MB, re-codificadas a WebP. Van a Vercel Blob o al
disco según el entorno ([backend.md](./backend.md#subidas-de-imágenes)).
Auditoría `upload.create`. Las subidas no se borran.

## Auditoría

`/admin/audit` lista `AuditLog` con filtros por admin, tipo de registro, un
registro y fechas. Cada entrada nombra su registro como lo hace el resto del panel
(número de pedido, nombre del producto, tema o categoría, código del cupón, email
del usuario, del mensaje o del suscriptor) con el id debajo; si el registro ya no
existe, queda el id. Productos, pedidos, cupones, usuarios, categorías, temas,
configuración, contenido y mensajes muestran su propio "Historial" (los 8 cambios
más recientes; el resto, con "Ver todo" en la auditoría filtrada por el registro). Cada entrada guarda el admin, su IP
(solo la que `client-ip.ts` confía; si no, vacía), la acción, la entidad y
`{campo: [antes, después]}`.

| Entidad | Acciones |
| --- | --- |
| `product` | `create`, `update`, `stock`, `archive`, `restore`, `delete` |
| `order` | `ship`, `deliver`, `cancel` |
| `review` | `delete` |
| `coupon` | `create`, `update`, `activate`, `deactivate` |
| `user` | `role`, `block`, `unblock` |
| `category`, `theme` | `create`, `update`, `reorder`, `delete` |
| `upload` | `create` |
| `settings` | `shipping`, `announcement`, `contact`, `featured` |
| `content` | `draft`, `publish`, `discard` |
| `message` | `read`, `unread`, `archive` |
| `subscriber` | `unsubscribe` |
| `export` | `orders`, `customers`, `newsletter`, `messages` |
