import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { pluralize } from "@/lib/utils";
import { HeroArt } from "./HeroArt";

/** LEGO stud pattern, drawn with the current text colour. */
const studs =
  "bg-[radial-gradient(circle,currentColor_3px,transparent_3.5px)] bg-size-[36px_36px] opacity-[0.06]";

interface HeroSectionProps {
  /** Sets in the catalogue, for the subtitle. */
  productCount: number;
  /** Sets on sale; the deals button only shows when there are some. */
  saleCount: number;
}

/**
 * Brand-yellow hero. The copy lifts in on load without ever being hidden
 * (it is the LCP element), the picture pops in and drifts on scroll.
 */
export function HeroSection({ productCount, saleCount }: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-linear-to-br from-primary to-primary-hover text-on-primary">
      <div aria-hidden="true" className={`absolute inset-0 ${studs}`} />

      <div className="container-custom relative z-10">
        <div className="grid min-h-[30rem] items-center gap-8 pt-12 pb-24 lg:grid-cols-2 lg:pt-16 lg:pb-32">
          <Stagger stagger={0.06}>
            <StaggerItem effect="lift">
              <Badge variant="sale" className="mb-4 bg-brand-red px-3 py-1 text-label text-on-brand-red">
                Nueva colección
              </Badge>
            </StaggerItem>
            <StaggerItem effect="lift">
              <h1 id="hero-title" className="text-display text-on-primary">
                Construye tu{" "}
                <span className="mt-2 inline-block -rotate-1 rounded-2xl bg-brand-red px-4 pb-1 text-on-brand-red shadow-lg">
                  universo LEGO
                </span>
              </h1>
            </StaggerItem>
            <StaggerItem effect="lift">
              <p className="mt-6 max-w-lg text-lg md:text-xl">
                Descubre {pluralize(productCount, "set")} de Star Wars, Marvel, Harry Potter y más. Cada pieza cuenta una
                historia.
              </p>
            </StaggerItem>
            <StaggerItem effect="lift" className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" className="group shadow-lg" render={<Link href="/search" />}>
                Explorar catálogo
                <ArrowRight
                  aria-hidden="true"
                  className="transition-[translate] duration-base ease-standard group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
                />
              </Button>
              {saleCount > 0 ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-on-primary text-on-primary hover:bg-on-primary hover:text-primary"
                  render={<Link href="#ofertas" />}
                >
                  Ver ofertas
                </Button>
              ) : null}
            </StaggerItem>
          </Stagger>

          <div className="relative hidden lg:block">
            <HeroArt
              src="https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png"
              alt="Casco LEGO de Captain Rex"
            />
          </div>
        </div>
      </div>

      {/* Wave divider into the next band */}
      <div aria-hidden="true" className="absolute right-0 -bottom-px left-0 text-bg-subtle">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="block w-full">
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </section>
  );
}
