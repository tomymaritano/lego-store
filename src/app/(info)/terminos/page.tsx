import Link from "next/link";
import { FileText } from "lucide-react";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { formatPrice } from "@/lib/utils";
import { LegalPage, type LegalSection } from "@/components/info/LegalPage";

export const metadata = pageMetadata({
  title: "Términos y condiciones",
  description: "Condiciones de uso de LEGO Store: compras, precios, envíos, devoluciones y garantía.",
  path: "/terminos",
});

const { commerce } = siteConfig;

const sections: LegalSection[] = [
  {
    id: "aceptacion",
    title: "Aceptación",
    body: (
      <p>
        Al usar {siteConfig.name} aceptas estos términos. Si no estás de acuerdo con alguno, te pedimos que no uses el
        sitio.
      </p>
    ),
  },
  {
    id: "compras",
    title: "Compras y precios",
    body: (
      <ul>
        <li>Los precios están expresados en pesos argentinos e incluyen impuestos.</li>
        <li>Un pedido se confirma cuando el pago es aprobado; te enviamos la confirmación por email.</li>
        <li>Si un producto se agota después de tu compra, te avisamos y te devolvemos el importe completo.</li>
      </ul>
    ),
  },
  {
    id: "envios",
    title: "Envíos",
    body: (
      <p>
        El envío cuesta {formatPrice(commerce.shippingCost)} y es gratis desde{" "}
        {formatPrice(commerce.freeShippingThreshold)}. Los plazos son estimados; puedes ver el detalle en{" "}
        <Link href="/envios">Envíos y entregas</Link>.
      </p>
    ),
  },
  {
    id: "devoluciones",
    title: "Cambios, devoluciones y arrepentimiento",
    body: (
      <p>
        Tienes {commerce.returnDays} días para cambios y devoluciones y 10 días para revocar la compra, según la Ley
        24.240 de Defensa del Consumidor. El procedimiento está en{" "}
        <Link href="/devoluciones">Cambios y devoluciones</Link>.
      </p>
    ),
  },
  {
    id: "garantia",
    title: "Garantía",
    body: (
      <p>
        Todos los productos son originales y tienen la garantía oficial del fabricante contra defectos de fabricación y
        piezas faltantes.
      </p>
    ),
  },
  {
    id: "propiedad",
    title: "Propiedad intelectual",
    body: (
      <p>
        LEGO®, el logotipo de LEGO y las configuraciones de ladrillos son marcas de The LEGO Group, que no patrocina,
        autoriza ni respalda este sitio. Las imágenes de productos pertenecen a sus titulares.
      </p>
    ),
  },
  {
    id: "demo",
    title: "Sitio de demostración",
    body: (
      <p>
        {siteConfig.name} es un proyecto de portafolio: no se realizan cobros ni envíos reales. Ante cualquier duda,{" "}
        <Link href="/contacto">escríbenos</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      icon={<FileText />}
      title="Términos y condiciones"
      description="Las reglas para comprar en la tienda, explicadas de forma clara."
      updated="17 de octubre de 2026"
      sections={sections}
    />
  );
}
