import { ShieldCheck } from "lucide-react";
import { contentMetadata, loadContentPage } from "@/lib/content/page";
import { LegalContentPage } from "@/components/content/LegalContentPage";

export const generateMetadata = () => contentMetadata("privacidad");

/** /privacidad: the admin's content (/admin/contenido) as numbered sections. */
export default async function PrivacyPage() {
  const { doc, updated } = await loadContentPage("privacidad");
  return <LegalContentPage doc={doc} icon={<ShieldCheck />} updated={updated} />;
}
