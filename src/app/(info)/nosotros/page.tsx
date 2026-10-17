import Link from "next/link";
import { BadgeCheck, Blocks, HeartHandshake, Smile } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getCategories, getProducts } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";
import { Button } from "@/components/ui";
import { FactCard, InfoPageHeader, Prose } from "@/components/info/InfoPage";

export const metadata = pageMetadata({
  title: "Sobre nosotros",
  description:
    "Somos una tienda hecha por fans de LEGO para fans de LEGO: sets originales, atención cercana y envíos a todo el país.",
  path: "/nosotros",
});

export default async function AboutPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const themes = new Set(products.map((product) => product.theme)).size;

  const stats = [
    { value: products.length, label: "sets en catálogo" },
    { value: categories.length, label: "categorías" },
    { value: themes, label: "temas y licencias" },
    { value: `${siteConfig.commerce.returnDays} días`, label: "para cambios" },
  ];

  return (
    <>
      <InfoPageHeader
        icon={<Blocks />}
        title="Sobre nosotros"
        description="Somos fans de LEGO que armamos la tienda que nos hubiera gustado encontrar: sets originales, bien explicados y con ayuda real cuando la necesitas."
      />

      <dl className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse rounded-2xl border border-border bg-bg-subtle p-5 text-center"
          >
            <dt className="text-label font-normal text-fg-secondary">{stat.label}</dt>
            <dd className="text-headline font-extrabold text-fg tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Prose>
        <h2>Nuestra historia</h2>
        <p>
          {siteConfig.name} nació de una colección que no paraba de crecer. Queríamos un lugar donde comparar sets con
          calma, saber exactamente cuántas piezas trae cada uno y recibirlos en casa sin sorpresas. Hoy reunimos
          helmets, Brickheadz, vehículos y coleccionables de Star Wars, Marvel, Disney y Harry Potter.
        </p>
        <h2>En qué creemos</h2>
      </Prose>

      <ul className="mt-4 mb-12 grid gap-4 md:grid-cols-3">
        <FactCard icon={<BadgeCheck />} title="Solo originales">
          Sets nuevos, en caja cerrada y con garantía oficial.
        </FactCard>
        <FactCard icon={<Smile />} title="Para todas las edades">
          Desde el primer set hasta la pieza de colección más buscada.
        </FactCard>
        <FactCard icon={<HeartHandshake />} title="Atención cercana">
          Personas reales que responden en menos de 24 horas hábiles.
        </FactCard>
      </ul>

      <Prose>
        <h2>Sobre este sitio</h2>
        <p>
          {siteConfig.name} es un <strong>proyecto de portafolio</strong>: los pedidos y pagos son simulados. LEGO® es
          una marca registrada de The LEGO Group, que no patrocina ni respalda esta tienda.
        </p>
      </Prose>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" render={<Link href="/" />}>Explorar la tienda</Button>
        <Button size="lg" variant="secondary" render={<Link href="/contacto" />}>
          Escríbenos
        </Button>
      </div>
    </>
  );
}
