import { CalendarClock, PackageCheck, Truck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { contentMetadata, loadContentPage } from "@/lib/content/page";
import { formatPrice } from "@/lib/utils";
import { FactCard } from "@/components/info/InfoPage";
import { ContentBlocks, ContentHeader } from "@/components/content/ContentBlocks";

export const generateMetadata = () => contentMetadata("envios");

const { deliveryDays } = siteConfig.commerce;

/** /envios: the shipping figures from the store's settings, then the admin's content (/admin/contenido). */
export default async function ShippingPage() {
  const { doc, settings } = await loadContentPage("envios");
  const { shipping } = settings;
  return (
    <>
      <ContentHeader icon={<Truck />} title={doc.title} description={doc.description} />

      <ul className="mb-12 grid gap-4 sm:grid-cols-3">
        <FactCard icon={<PackageCheck />} title="Envío gratis">
          En compras desde {formatPrice(shipping.freeFrom)}.
        </FactCard>
        <FactCard icon={<Truck />} title={`Costo: ${formatPrice(shipping.cost)}`}>
          Tarifa única para pedidos menores al mínimo.
        </FactCard>
        <FactCard icon={<CalendarClock />} title={`${deliveryDays.min} a ${deliveryDays.max} días hábiles`}>
          Según la zona de entrega.
        </FactCard>
      </ul>

      <ContentBlocks blocks={doc.blocks} />
    </>
  );
}
