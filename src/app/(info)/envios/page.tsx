import Link from "next/link";
import { CalendarClock, MapPinned, PackageCheck, Truck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { formatPrice } from "@/lib/utils";
import { FactCard, InfoPageHeader, Prose } from "@/components/info/InfoPage";

export const metadata = pageMetadata({
  title: "Envíos y entregas",
  description: `Costos, plazos y seguimiento de envíos. Envío gratis en compras desde ${formatPrice(siteConfig.commerce.freeShippingThreshold)}.`,
  path: "/envios",
});

const { commerce } = siteConfig;

const zones = [
  { zone: "CABA y Gran Buenos Aires", time: "1 a 3 días hábiles" },
  { zone: "Región Centro y Cuyo", time: "3 a 5 días hábiles" },
  { zone: "NOA, NEA y Patagonia", time: `5 a ${commerce.deliveryDays.max} días hábiles` },
];

export default function ShippingPage() {
  return (
    <>
      <InfoPageHeader
        icon={<Truck />}
        title="Envíos y entregas"
        description="Enviamos a todo el país. Tu pedido sale del depósito en 24 horas hábiles, bien protegido para que llegue intacto."
      />

      <ul className="mb-12 grid gap-4 sm:grid-cols-3">
        <FactCard icon={<PackageCheck />} title="Envío gratis">
          En compras desde {formatPrice(commerce.freeShippingThreshold)}.
        </FactCard>
        <FactCard icon={<Truck />} title={`Costo: ${formatPrice(commerce.shippingCost)}`}>
          Tarifa única para pedidos menores al mínimo.
        </FactCard>
        <FactCard
          icon={<CalendarClock />}
          title={`${commerce.deliveryDays.min} a ${commerce.deliveryDays.max} días hábiles`}
        >
          Según la zona de entrega.
        </FactCard>
      </ul>

      <Prose>
        <h2>Plazos por zona</h2>
        <p>Los plazos cuentan desde que el pedido se despacha y no incluyen fines de semana ni feriados.</p>
      </Prose>
      <div className="mt-4 mb-10 max-w-3xl overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Plazos de entrega por zona</caption>
          <thead className="bg-bg-muted text-fg">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="inline-flex items-center gap-2">
                  <MapPinned aria-hidden="true" className="size-4 text-fg-muted" />
                  Zona
                </span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Plazo estimado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface text-fg-secondary">
            {zones.map((row) => (
              <tr key={row.zone}>
                <th scope="row" className="px-4 py-3 font-medium text-fg">
                  {row.zone}
                </th>
                <td className="px-4 py-3">{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Prose>
        <h2>Seguimiento del pedido</h2>
        <p>
          Cuando tu pedido sale del depósito te enviamos un email con el <strong>código de seguimiento</strong> del
          correo. Si pasaron más días de los indicados, <Link href="/contacto">escríbenos</Link> con tu número de
          pedido.
        </p>

        <h2>Al recibir el paquete</h2>
        <ul>
          <li>Revisa que la caja exterior no esté dañada antes de firmar la entrega.</li>
          <li>Si notas golpes o roturas, déjalo asentado con el transportista y avísanos en 48 horas.</li>
          <li>Conserva el embalaje original por si necesitas hacer un cambio.</li>
        </ul>

        <p>
          ¿Algo no salió como esperabas? Mira cómo hacer un <Link href="/devoluciones">cambio o devolución</Link>.
        </p>
      </Prose>
    </>
  );
}
