import Link from "next/link";
import { ArrowRight, Truck } from "lucide-react";
import { Button } from "@/components/ui";
import { Reveal } from "@/components/motion/Reveal";
import { formatPrice } from "@/lib/utils";

/** Closing call to action: free-shipping threshold (the store's setting) and a way into the catalogue. */
export function CtaBanner({ freeShippingFrom }: { freeShippingFrom: number }) {
  return (
    <section aria-labelledby="cta-title" className="bg-bg pb-16 md:pb-20">
      <div className="container-custom">
        <Reveal className="relative overflow-hidden rounded-3xl bg-info-surface px-6 py-12 text-on-info-surface shadow-card md:px-12 md:py-16">
          {/* LEGO studs, decorative */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle,currentColor_4px,transparent_4.5px)] bg-size-[44px_44px] opacity-10"
          />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-label tracking-wider uppercase">
                <Truck aria-hidden="true" className="size-5" />
                Envío gratis desde {formatPrice(freeShippingFrom)}
              </p>
              <h2 id="cta-title" className="mt-3 text-on-info-surface">
                Arma tu próxima aventura
              </h2>
              <p className="mt-3 text-title font-normal">
                Filtra por tema, edad o cantidad de piezas y encuentra el set ideal para regalar o para tu colección.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="group shadow-lg" render={<Link href="/search" />}>
                Ver catálogo completo
                <ArrowRight
                  aria-hidden="true"
                  className="transition-[translate] duration-base ease-standard group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
                />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-on-info-surface text-on-info-surface hover:bg-on-info-surface hover:text-info-surface"
                render={<Link href="/search?isNew=1" />}
              >
                Ver novedades
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
