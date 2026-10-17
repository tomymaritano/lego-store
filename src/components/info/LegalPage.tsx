import type { ReactNode } from "react";
import { InfoPageHeader, Prose, TableOfContents } from "./InfoPage";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  description: string;
  icon: ReactNode;
  updated: string;
  sections: LegalSection[];
}

/** Legal text page: header, table of contents and numbered sections with anchors. */
export function LegalPage({ title, description, icon, updated, sections }: LegalPageProps) {
  return (
    <>
      <InfoPageHeader icon={icon} title={title} description={description} meta={`Última actualización: ${updated}`} />
      <TableOfContents items={sections} />
      <Prose>
        {sections.map((section, index) => (
          <section key={section.id} aria-labelledby={section.id} className="space-y-4">
            <h2 id={section.id}>
              {index + 1}. {section.title}
            </h2>
            {section.body}
          </section>
        ))}
      </Prose>
    </>
  );
}
