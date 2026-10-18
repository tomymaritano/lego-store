import Link from "next/link";
import { HelpCircle, MessageCircle } from "lucide-react";
import { contentMetadata, loadContentPage } from "@/lib/content/page";
import { markdownToText } from "@/lib/content/text";
import type { ContentBlock } from "@/lib/content/types";
import { serializeJsonLd } from "@/lib/structuredData";
import { Button } from "@/components/ui";
import { ContentBlocks, ContentHeader } from "@/components/content/ContentBlocks";

export const generateMetadata = () => contentMetadata("faq");

/** FAQPage structured data from the page's question groups (answers as plain text). */
function faqJsonLd(blocks: ContentBlock[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: blocks.flatMap((block) =>
      block.type === "faq"
        ? block.items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: markdownToText(item.answer) },
          }))
        : []
    ),
  };
}

/** /faq: the admin's question groups (/admin/contenido), their structured data and a way to write to the store. */
export default async function FaqPage() {
  const { doc } = await loadContentPage("faq");
  return (
    <>
      {/* serializeJsonLd escapes "<": an answer cannot close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd(doc.blocks)) }} />
      <ContentHeader icon={<HelpCircle />} title={doc.title} description={doc.description} />
      <ContentBlocks blocks={doc.blocks} />

      <section
        aria-labelledby="faq-contact"
        className="mt-12 flex flex-col items-start gap-4 rounded-2xl bg-info p-6 text-on-info sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 id="faq-contact" className="text-title text-on-info">
            ¿Te quedó alguna duda?
          </h2>
          <p className="mt-1">Nuestro equipo responde en menos de 24 horas hábiles.</p>
        </div>
        <Button variant="secondary" render={<Link href="/contacto" />}>
          <MessageCircle aria-hidden="true" />
          Contactar
        </Button>
      </section>
    </>
  );
}
