import Link from "next/link";
import { Blocks } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getCategories, getProducts } from "@/lib/api";
import { contentMetadata, loadContentPage } from "@/lib/content/page";
import { Button } from "@/components/ui";
import { ContentBlocks, ContentHeader } from "@/components/content/ContentBlocks";

export const generateMetadata = () => contentMetadata("nosotros");

/** /nosotros: the catalogue's numbers, the admin's content (/admin/contenido) and the ways on. */
export default async function AboutPage() {
  const [{ doc }, products, categories] = await Promise.all([loadContentPage("nosotros"), getProducts(), getCategories()]);
  const themes = new Set(products.map((product) => product.theme)).size;

  const stats = [
    { value: products.length, label: "sets en catálogo" },
    { value: categories.length, label: "categorías" },
    { value: themes, label: "temas y licencias" },
    { value: `${siteConfig.commerce.returnDays} días`, label: "para cambios" },
  ];

  return (
    <>
      <ContentHeader icon={<Blocks />} title={doc.title} description={doc.description} />

      <dl className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse rounded-2xl border border-border bg-bg-subtle p-5 text-center">
            <dt className="text-label font-normal text-fg-secondary">{stat.label}</dt>
            <dd className="text-headline font-extrabold text-fg tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <ContentBlocks blocks={doc.blocks} />

      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" render={<Link href="/" />}>
          Explorar la tienda
        </Button>
        <Button size="lg" variant="secondary" render={<Link href="/contacto" />}>
          Escríbenos
        </Button>
      </div>
    </>
  );
}
