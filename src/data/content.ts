import type { ContentSlug } from "@/lib/content/pages";
import type { ContentDocument } from "@/lib/content/types";

/**
 * The info pages' first content: what the seed (prisma/seed/index.ts)
 * publishes for a page that has none yet (an admin's edits are never
 * overwritten). Same text the pages had in code, as Markdown with the
 * settings' placeholders where a figure belongs to the settings
 * ({{costo_envio}}, {{envio_gratis_desde}}…, src/lib/settings/placeholders.ts).
 */
export const seedContent: Record<ContentSlug, ContentDocument> = {
  faq: {
    title: "Preguntas frecuentes",
    description: "Todo lo que necesitas saber sobre pedidos, envíos y devoluciones. ¿No encuentras tu respuesta? [Escríbenos](/contacto).",
    blocks: [
      {
        type: "faq",
        id: "pedidos",
        title: "Pedidos y pagos",
        items: [
          {
            id: "como-comprar",
            question: "¿Cómo hago un pedido?",
            answer:
              "Agrega los sets al carrito, ábrelo y elige **Finalizar compra**. Completa tus datos de envío y de pago, revisa el resumen y confirma. Te enviaremos un email con el número de pedido.",
          },
          {
            id: "medios-de-pago",
            question: "¿Qué medios de pago aceptan?",
            answer:
              "Pagas con Mercado Pago: tarjetas de crédito (en cuotas) y débito, dinero en tu cuenta de Mercado Pago o efectivo en un punto de pago. El cobro se realiza al confirmar el pedido.",
          },
          {
            id: "modificar",
            question: "¿Puedo modificar o cancelar un pedido?",
            answer: "Sí, mientras no haya sido despachado. [Escríbenos](/contacto) con tu número de pedido y lo resolvemos.",
          },
        ],
      },
      {
        type: "faq",
        id: "envios",
        title: "Envíos",
        items: [
          {
            id: "costo",
            question: "¿Cuánto cuesta el envío?",
            answer:
              "El envío cuesta {{costo_envio}} y es **gratis en compras desde {{envio_gratis_desde}}**. Más detalles en [Envíos y entregas](/envios).",
          },
          {
            id: "plazo",
            question: "¿Cuánto tarda en llegar mi pedido?",
            answer:
              "Entre {{dias_entrega_min}} y {{dias_entrega_max}} días hábiles según tu ubicación. Cuando el pedido sale del depósito te enviamos el código de seguimiento.",
          },
        ],
      },
      {
        type: "faq",
        id: "devoluciones",
        title: "Cambios y devoluciones",
        items: [
          {
            id: "devolver",
            question: "¿Puedo devolver un producto?",
            answer:
              "Sí, tienes {{dias_devolucion}} días desde que lo recibes, con la caja sin abrir y en su estado original. Mira el paso a paso en [Cambios y devoluciones](/devoluciones).",
          },
          {
            id: "piezas",
            question: "Me llegó un set con piezas faltantes, ¿qué hago?",
            answer:
              "[Escríbenos](/contacto) con el número de set y las piezas que faltan (aparecen en el inventario al final del manual): te las reponemos sin costo.",
          },
        ],
      },
      {
        type: "faq",
        id: "productos",
        title: "Productos",
        items: [
          { id: "originales", question: "¿Los productos son originales?", answer: "Sí. Todos los sets son originales, nuevos, en caja cerrada y con garantía oficial." },
          {
            id: "edad",
            question: "¿Cómo elijo un set según la edad?",
            answer:
              "Cada producto indica la edad recomendada y la cantidad de piezas en sus especificaciones. Si dudas entre varios, usa [Comparar](/compare) para verlos lado a lado (hasta 4 sets).",
          },
        ],
      },
    ],
  },

  envios: {
    title: "Envíos y entregas",
    description: "Enviamos a todo el país. Tu pedido sale del depósito en 24 horas hábiles, bien protegido para que llegue intacto.",
    blocks: [
      {
        type: "markdown",
        id: "plazos",
        text: `## Plazos por zona

Los plazos cuentan desde que el pedido se despacha y no incluyen fines de semana ni feriados.

| Zona | Plazo estimado |
| --- | --- |
| CABA y Gran Buenos Aires | 1 a 3 días hábiles |
| Región Centro y Cuyo | 3 a 5 días hábiles |
| NOA, NEA y Patagonia | 5 a {{dias_entrega_max}} días hábiles |`,
      },
      {
        type: "markdown",
        id: "seguimiento",
        text: `## Seguimiento del pedido

Cuando tu pedido sale del depósito te enviamos un email con el **código de seguimiento** del correo. Si pasaron más días de los indicados, [escríbenos](/contacto) con tu número de pedido.

## Al recibir el paquete

- Revisa que la caja exterior no esté dañada antes de firmar la entrega.
- Si notas golpes o roturas, déjalo asentado con el transportista y avísanos en 48 horas.
- Conserva el embalaje original por si necesitas hacer un cambio.

¿Algo no salió como esperabas? Mira cómo hacer un [cambio o devolución](/devoluciones).`,
      },
    ],
  },

  devoluciones: {
    title: "Cambios y devoluciones",
    description: "Si tu compra no es lo que esperabas, tienes {{dias_devolucion}} días desde que la recibes para cambiarla o devolverla.",
    blocks: [
      {
        type: "list",
        id: "pasos",
        title: "Cómo hacer una devolución",
        style: "steps",
        items: [
          { id: "avisanos", title: "Avísanos", text: "Escríbenos desde el formulario de contacto con tu número de pedido y el motivo." },
          { id: "paquete", title: "Prepara el paquete", text: "Guarda el set en su caja original, sin abrir, dentro de un embalaje que lo proteja." },
          { id: "envio", title: "Envíalo sin costo", text: "Te mandamos una etiqueta prepaga para despacharlo en cualquier sucursal del correo." },
          { id: "reembolso", title: "Recibe tu reembolso", text: "Cuando lo recibimos, te devolvemos el dinero al mismo medio de pago en hasta 10 días hábiles." },
        ],
      },
      {
        type: "markdown",
        id: "condiciones",
        text: `## Condiciones

- Plazo: **{{dias_devolucion}} días corridos** desde la entrega.
- La caja debe estar cerrada, sin abrir y en su estado original, con todos sus accesorios.
- Si el producto llegó dañado o con piezas faltantes, el cambio o la reposición no tienen costo.
- Los productos de ediciones limitadas pueden cambiarse solo si llegaron con fallas.

## Arrepentimiento de compra

Según la Ley de Defensa del Consumidor, puedes revocar la compra dentro de los 10 días corridos desde la entrega sin dar explicaciones. El envío de vuelta corre por nuestra cuenta.`,
      },
    ],
  },

  nosotros: {
    title: "Sobre nosotros",
    description:
      "Somos fans de LEGO que armamos la tienda que nos hubiera gustado encontrar: sets originales, bien explicados y con ayuda real cuando la necesitas.",
    blocks: [
      {
        type: "markdown",
        id: "historia",
        text: `## Nuestra historia

{{tienda}} nació de una colección que no paraba de crecer. Queríamos un lugar donde comparar sets con calma, saber exactamente cuántas piezas trae cada uno y recibirlos en casa sin sorpresas. Hoy reunimos helmets, Brickheadz, vehículos y coleccionables de Star Wars, Marvel, Disney y Harry Potter.`,
      },
      {
        type: "list",
        id: "valores",
        title: "En qué creemos",
        style: "cards",
        items: [
          { id: "originales", title: "Solo originales", text: "Sets nuevos, en caja cerrada y con garantía oficial." },
          { id: "edades", title: "Para todas las edades", text: "Desde el primer set hasta la pieza de colección más buscada." },
          { id: "atencion", title: "Atención cercana", text: "Personas reales que responden en menos de 24 horas hábiles." },
        ],
      },
      {
        type: "markdown",
        id: "sitio",
        text: `## Sobre este sitio

{{tienda}} es un **proyecto de portafolio**: los pedidos y pagos son de prueba. LEGO® es una marca registrada de The LEGO Group, que no patrocina ni respalda esta tienda.`,
      },
    ],
  },

  privacidad: {
    title: "Política de privacidad",
    description: "Cuidamos tus datos: te contamos cuáles usamos, para qué y cómo puedes controlarlos.",
    blocks: [
      {
        type: "markdown",
        id: "secciones",
        text: `## Qué datos usamos

Solo los necesarios para que puedas comprar:

- Nombre, email, teléfono y dirección de entrega, que ingresas en el checkout.
- Tu email, si te suscribes al newsletter o nos escribes desde el formulario de contacto.
- La comparación, las búsquedas recientes y el tema elegido, guardados solo en tu navegador; el carrito y tus favoritos, también en tu cuenta si inicias sesión.

**Nunca guardamos los datos completos de tu tarjeta.**

## Para qué los usamos

- Procesar y enviar tus pedidos, y avisarte de su estado.
- Responder tus consultas.
- Enviarte novedades y ofertas, solo si te suscribiste. Puedes darte de baja desde el enlace de cualquier email.

## Almacenamiento en tu navegador

No usamos cookies de seguimiento ni publicidad. Usamos solo las cookies necesarias para tu sesión y tu compra. El carrito, los favoritos, las búsquedas recientes y el tema se guardan además en el almacenamiento local de tu navegador; puedes borrarlos cuando quieras desde su configuración.

## Con quién los compartimos

Solo con quienes nos ayudan a entregarte el pedido (el correo o la empresa de logística) y a procesar el pago. No vendemos ni cedemos tus datos.

## Tus derechos

Puedes pedir acceso, rectificación o eliminación de tus datos en cualquier momento, como prevé la Ley 25.326 de Protección de Datos Personales. Escríbenos a {{email}} o desde la página de [contacto](/contacto).

## Sitio de demostración

{{tienda}} es un proyecto de portafolio: los pagos se hacen en modo de prueba y no se envían productos.`,
      },
    ],
  },

  terminos: {
    title: "Términos y condiciones",
    description: "Las reglas para comprar en la tienda, explicadas de forma clara.",
    blocks: [
      {
        type: "markdown",
        id: "secciones",
        text: `## Aceptación

Al usar {{tienda}} aceptas estos términos. Si no estás de acuerdo con alguno, te pedimos que no uses el sitio.

## Compras y precios

- Los precios están expresados en pesos argentinos e incluyen impuestos.
- Un pedido se confirma cuando el pago es aprobado; te enviamos la confirmación por email.
- Si un producto se agota después de tu compra, te avisamos y te devolvemos el importe completo.

## Envíos

El envío cuesta {{costo_envio}} y es gratis desde {{envio_gratis_desde}}. Los plazos son estimados; puedes ver el detalle en [Envíos y entregas](/envios).

## Cambios, devoluciones y arrepentimiento

Tienes {{dias_devolucion}} días para cambios y devoluciones y 10 días para revocar la compra, según la Ley 24.240 de Defensa del Consumidor. El procedimiento está en [Cambios y devoluciones](/devoluciones).

## Garantía

Todos los productos son originales y tienen la garantía oficial del fabricante contra defectos de fabricación y piezas faltantes.

## Propiedad intelectual

LEGO®, el logotipo de LEGO y las configuraciones de ladrillos son marcas de The LEGO Group, que no patrocina, autoriza ni respalda este sitio. Las imágenes de productos pertenecen a sus titulares.

## Sitio de demostración

{{tienda}} es un proyecto de portafolio: no se realizan cobros ni envíos reales. Ante cualquier duda, [escríbenos](/contacto).`,
      },
    ],
  },

  contacto: {
    title: "Contacto",
    description: "¿Tienes una consulta? Revisa las [preguntas frecuentes](/faq) o escríbenos: respondemos en menos de 24 horas hábiles.",
    blocks: [],
  },
};
