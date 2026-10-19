import type { ReactNode } from "react";
import type { ContentDocument } from "@/lib/content/types";
import { ContentBlocks, ContentHeader, ContentTableOfContents } from "./ContentBlocks";

/**
 * A legal page from its content: header with the publication date, a table
 * of contents and numbered sections (the Markdown's `## ` headings).
 */
export function LegalContentPage({ doc, icon, updated }: { doc: ContentDocument; icon: ReactNode; updated: string | null }) {
  return (
    <>
      <ContentHeader icon={icon} title={doc.title} description={doc.description} meta={updated ? `Última actualización: ${updated}` : undefined} />
      <ContentTableOfContents blocks={doc.blocks} />
      <ContentBlocks blocks={doc.blocks} legal />
    </>
  );
}
