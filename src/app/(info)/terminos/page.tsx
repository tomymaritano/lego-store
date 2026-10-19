import { FileText } from "lucide-react";
import { contentMetadata, loadContentPage } from "@/lib/content/page";
import { LegalContentPage } from "@/components/content/LegalContentPage";

export const generateMetadata = () => contentMetadata("terminos");

/** /terminos: the admin's content (/admin/contenido) as numbered sections. */
export default async function TermsPage() {
  const { doc, updated } = await loadContentPage("terminos");
  return <LegalContentPage doc={doc} icon={<FileText />} updated={updated} />;
}
