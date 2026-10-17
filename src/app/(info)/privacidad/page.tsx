import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { LegalPage, type LegalSection } from "@/components/info/LegalPage";

export const metadata = pageMetadata({
  title: "Política de privacidad",
  description: "Qué datos usa LEGO Store, para qué y cómo puedes ejercer tus derechos sobre ellos.",
  path: "/privacidad",
});

const sections: LegalSection[] = [
  {
    id: "datos",
    title: "Qué datos usamos",
    body: (
      <>
        <p>Solo los necesarios para que puedas comprar:</p>
        <ul>
          <li>Nombre, email, teléfono y dirección de entrega, que ingresas en el checkout.</li>
          <li>Tu email, si te suscribes al newsletter o nos escribes desde el formulario de contacto.</li>
          <li>El carrito, tus favoritos, la comparación y el tema elegido, guardados solo en tu navegador.</li>
        </ul>
        <p>
          <strong>Nunca guardamos los datos completos de tu tarjeta.</strong>
        </p>
      </>
    ),
  },
  {
    id: "uso",
    title: "Para qué los usamos",
    body: (
      <ul>
        <li>Procesar y enviar tus pedidos, y avisarte de su estado.</li>
        <li>Responder tus consultas.</li>
        <li>Enviarte novedades y ofertas, solo si te suscribiste. Puedes darte de baja desde cualquier email.</li>
      </ul>
    ),
  },
  {
    id: "almacenamiento-local",
    title: "Almacenamiento en tu navegador",
    body: (
      <p>
        No usamos cookies de seguimiento ni publicidad. El carrito, los favoritos, las búsquedas recientes y el tema se
        guardan en el almacenamiento local de tu navegador; puedes borrarlos cuando quieras desde su configuración.
      </p>
    ),
  },
  {
    id: "terceros",
    title: "Con quién los compartimos",
    body: (
      <p>
        Solo con quienes nos ayudan a entregarte el pedido (el correo o la empresa de logística) y a procesar el pago.
        No vendemos ni cedemos tus datos.
      </p>
    ),
  },
  {
    id: "derechos",
    title: "Tus derechos",
    body: (
      <p>
        Puedes pedir acceso, rectificación o eliminación de tus datos en cualquier momento, como prevé la Ley 25.326 de
        Protección de Datos Personales. Escríbenos a{" "}
        <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a> o desde la página de{" "}
        <Link href="/contacto">contacto</Link>.
      </p>
    ),
  },
  {
    id: "demo",
    title: "Sitio de demostración",
    body: (
      <p>
        {siteConfig.name} es un proyecto de portafolio: los formularios no envían información a ningún servidor y los
        pedidos son simulados.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      icon={<ShieldCheck />}
      title="Política de privacidad"
      description="Cuidamos tus datos: te contamos cuáles usamos, para qué y cómo puedes controlarlos."
      updated="17 de octubre de 2026"
      sections={sections}
    />
  );
}
