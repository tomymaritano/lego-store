import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { Button } from "@/components/ui";
import { InfoPageHeader, Prose } from "@/components/info/InfoPage";

const { returnDays } = siteConfig.commerce;

export const metadata = pageMetadata({
  title: "Cambios y devoluciones",
  description: `Tienes ${returnDays} días para cambiar o devolver tu compra. Te contamos cómo hacerlo, paso a paso.`,
  path: "/devoluciones",
});

const steps = [
  {
    title: "Avísanos",
    text: "Escríbenos desde el formulario de contacto con tu número de pedido y el motivo.",
  },
  {
    title: "Prepara el paquete",
    text: "Guarda el set en su caja original, sin abrir, dentro de un embalaje que lo proteja.",
  },
  {
    title: "Envíalo sin costo",
    text: "Te mandamos una etiqueta prepaga para despacharlo en cualquier sucursal del correo.",
  },
  {
    title: "Recibe tu reembolso",
    text: "Cuando lo recibimos, te devolvemos el dinero al mismo medio de pago en hasta 10 días hábiles.",
  },
];

export default function ReturnsPage() {
  return (
    <>
      <InfoPageHeader
        icon={<RotateCcw />}
        title="Cambios y devoluciones"
        description={`Si tu compra no es lo que esperabas, tienes ${returnDays} días desde que la recibes para cambiarla o devolverla.`}
      />

      <section aria-labelledby="returns-steps" className="mb-12">
        <h2 id="returns-steps" className="mb-6 text-2xl">
          Cómo hacer una devolución
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-on-primary"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-fg">
                  <span className="sr-only">Paso {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-fg-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Prose>
        <h2>Condiciones</h2>
        <ul>
          <li>
            Plazo: <strong>{returnDays} días corridos</strong> desde la entrega.
          </li>
          <li>La caja debe estar cerrada, sin abrir y en su estado original, con todos sus accesorios.</li>
          <li>Si el producto llegó dañado o con piezas faltantes, el cambio o la reposición no tienen costo.</li>
          <li>Los productos de ediciones limitadas pueden cambiarse solo si llegaron con fallas.</li>
        </ul>

        <h2>Arrepentimiento de compra</h2>
        <p>
          Según la Ley de Defensa del Consumidor, puedes revocar la compra dentro de los 10 días corridos desde la
          entrega sin dar explicaciones. El envío de vuelta corre por nuestra cuenta.
        </p>
      </Prose>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button render={<Link href="/contacto" />}>Iniciar una devolución</Button>
        <Button variant="secondary" render={<Link href="/faq" />}>
          Ver preguntas frecuentes
        </Button>
      </div>
    </>
  );
}
