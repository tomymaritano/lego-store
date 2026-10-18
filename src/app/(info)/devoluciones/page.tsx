import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { contentMetadata, loadContentPage } from "@/lib/content/page";
import { Button } from "@/components/ui";
import { ContentBlocks, ContentHeader } from "@/components/content/ContentBlocks";

export const generateMetadata = () => contentMetadata("devoluciones");

/** /devoluciones: the admin's content (/admin/contenido) and the ways to start a return. */
export default async function ReturnsPage() {
  const { doc } = await loadContentPage("devoluciones");
  return (
    <>
      <ContentHeader icon={<RotateCcw />} title={doc.title} description={doc.description} />
      <ContentBlocks blocks={doc.blocks} />

      <div className="mt-10 flex flex-wrap gap-3">
        <Button render={<Link href="/contacto" />}>Iniciar una devolución</Button>
        <Button variant="secondary" render={<Link href="/faq" />}>
          Ver preguntas frecuentes
        </Button>
      </div>
    </>
  );
}
