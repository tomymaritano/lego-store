import Link from "next/link";
import { HelpCircle, MessageCircle } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/settings";
import type { StoreSettings } from "@/lib/settings/defaults";
import { pageMetadata } from "@/lib/metadata";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui";
import { Accordion, type AccordionItem } from "@/components/info/Accordion";
import { InfoPageHeader } from "@/components/info/InfoPage";

export const metadata = pageMetadata({
  title: "Preguntas frecuentes",
  description: "Respuestas sobre pedidos, pagos, envíos, cambios y devoluciones en LEGO Store.",
  path: "/faq",
});

const { commerce } = siteConfig;

/** Plain-text answers too, for the FAQPage structured data. */
const sectionsFor = ({ shipping }: StoreSettings): { id: string; title: string; items: (AccordionItem & { text: string })[] }[] => [
  {
    id: "pedidos",
    title: "Pedidos y pagos",
    items: [
      {
        question: "¿Cómo hago un pedido?",
        text: "Agrega los sets al carrito, abre el carrito y elige Finalizar compra. Completa tus datos de envío y de pago y confirma el pedido.",
        answer: (
          <p>
            Agrega los sets al carrito, ábrelo y elige <strong>Finalizar compra</strong>. Completa tus datos de envío y
            de pago, revisa el resumen y confirma. Te enviaremos un email con el número de pedido.
          </p>
        ),
      },
      {
        question: "¿Qué medios de pago aceptan?",
        text: "Tarjetas de crédito y débito Visa, Mastercard y American Express.",
        answer: (
          <p>
            Tarjetas de crédito y débito Visa, Mastercard y American Express. El cobro se realiza al confirmar el
            pedido.
          </p>
        ),
      },
      {
        question: "¿Puedo modificar o cancelar un pedido?",
        text: "Sí, mientras no haya sido despachado. Escríbenos con tu número de pedido.",
        answer: (
          <p>
            Sí, mientras no haya sido despachado. <Link href="/contacto">Escríbenos</Link> con tu número de pedido y lo
            resolvemos.
          </p>
        ),
      },
    ],
  },
  {
    id: "envios",
    title: "Envíos",
    items: [
      {
        question: "¿Cuánto cuesta el envío?",
        text: `El envío cuesta ${formatPrice(shipping.cost)} y es gratis en compras desde ${formatPrice(shipping.freeFrom)}.`,
        answer: (
          <p>
            El envío cuesta {formatPrice(shipping.cost)} y es{" "}
            <strong>gratis en compras desde {formatPrice(shipping.freeFrom)}</strong>. Más detalles en{" "}
            <Link href="/envios">Envíos y entregas</Link>.
          </p>
        ),
      },
      {
        question: "¿Cuánto tarda en llegar mi pedido?",
        text: `Entre ${commerce.deliveryDays.min} y ${commerce.deliveryDays.max} días hábiles según tu ubicación.`,
        answer: (
          <p>
            Entre {commerce.deliveryDays.min} y {commerce.deliveryDays.max} días hábiles según tu ubicación. Cuando el
            pedido sale del depósito te enviamos el código de seguimiento.
          </p>
        ),
      },
    ],
  },
  {
    id: "devoluciones",
    title: "Cambios y devoluciones",
    items: [
      {
        question: "¿Puedo devolver un producto?",
        text: `Sí, tienes ${commerce.returnDays} días desde que lo recibes, con la caja sin abrir.`,
        answer: (
          <p>
            Sí, tienes {commerce.returnDays} días desde que lo recibes, con la caja sin abrir y en su estado original.
            Mira el paso a paso en <Link href="/devoluciones">Cambios y devoluciones</Link>.
          </p>
        ),
      },
      {
        question: "Me llegó un set con piezas faltantes, ¿qué hago?",
        text: "Escríbenos con el número de set y las piezas que faltan: te las reponemos sin costo.",
        answer: (
          <p>
            <Link href="/contacto">Escríbenos</Link> con el número de set y las piezas que faltan (aparecen en el
            inventario al final del manual): te las reponemos sin costo.
          </p>
        ),
      },
    ],
  },
  {
    id: "productos",
    title: "Productos",
    items: [
      {
        question: "¿Los productos son originales?",
        text: "Sí. Todos los sets son originales, nuevos y con garantía oficial.",
        answer: <p>Sí. Todos los sets son originales, nuevos, en caja cerrada y con garantía oficial.</p>,
      },
      {
        question: "¿Cómo elijo un set según la edad?",
        text: "Cada producto indica la edad recomendada en sus especificaciones. También puedes comparar hasta 4 sets.",
        answer: (
          <p>
            Cada producto indica la edad recomendada y la cantidad de piezas en sus especificaciones. Si dudas entre
            varios, usa <Link href="/compare">Comparar</Link> para verlos lado a lado (hasta 4 sets).
          </p>
        ),
      },
    ],
  },
];

const structuredDataFor = (sections: ReturnType<typeof sectionsFor>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: sections.flatMap((section) =>
    section.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.text },
    }))
  ),
});

export default async function FaqPage() {
  const sections = sectionsFor(await getStoreSettings());
  const structuredData = structuredDataFor(sections);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <InfoPageHeader
        icon={<HelpCircle />}
        title="Preguntas frecuentes"
        description="Todo lo que necesitas saber sobre pedidos, envíos y devoluciones. ¿No encuentras tu respuesta? Escríbenos."
      />

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`faq-${section.id}`}>
            <h2 id={`faq-${section.id}`} className="mb-4 text-heading">
              {section.title}
            </h2>
            <Accordion items={section.items} name={`faq-${section.id}`} />
          </section>
        ))}
      </div>

      <section
        aria-labelledby="faq-contact"
        className="mt-12 flex flex-col items-start gap-4 rounded-2xl bg-info p-6 text-on-info sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 id="faq-contact" className="text-title text-on-info">
            ¿Te quedó alguna duda?
          </h2>
          <p className="mt-1">Nuestro equipo responde en menos de 24 horas hábiles.</p>
        </div>
        <Button variant="secondary" render={<Link href="/contacto" />}>
          <MessageCircle aria-hidden="true" />
          Contactar
        </Button>
      </section>
    </>
  );
}
