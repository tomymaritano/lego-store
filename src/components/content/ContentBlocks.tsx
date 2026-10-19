import { BadgeCheck } from "lucide-react";
import type { ContentBlock, ListBlock } from "@/lib/content/types";
import { legalHeadings, type LegalHeading } from "@/lib/content/text";
import { Accordion } from "@/components/info/Accordion";
import { FactCard, InfoPageHeader, Prose, TableOfContents } from "@/components/info/InfoPage";
import { Markdown } from "./Markdown";

/*
 * An info page's blocks (src/lib/content/types.ts) on the design system:
 * the public pages render them on the server and /admin/contenido's preview
 * in the browser, with the same components, so the preview is the page.
 * Texts arrive with their placeholders already filled (fillDocument).
 */

function ListBlockView({ block }: { block: ListBlock }) {
  const titleId = `block-${block.id}`;
  const Heading = block.title ? "h3" : "h2";
  // Without a title the list is not a section of its own (an unnamed <section> is no landmark anyway).
  const Wrapper = block.title ? "section" : "div";
  return (
    <Wrapper aria-labelledby={block.title ? titleId : undefined} className="space-y-6">
      {block.title ? (
        <h2 id={titleId} className="text-heading">
          {block.title}
        </h2>
      ) : null}
      {block.style === "steps" ? (
        <ol className="grid gap-4 sm:grid-cols-2">
          {block.items.map((item, index) => (
            <li key={item.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-title font-extrabold text-on-primary"
              >
                {index + 1}
              </span>
              <div>
                <Heading className="text-body font-semibold text-fg">
                  <span className="sr-only">Paso {index + 1}: </span>
                  {item.title}
                </Heading>
                <p className="mt-1 text-label font-normal text-fg-secondary">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {block.items.map((item) => (
            <FactCard key={item.id} icon={<BadgeCheck />} title={item.title} headingLevel={block.title ? "h3" : "h2"}>
              {item.text}
            </FactCard>
          ))}
        </ul>
      )}
    </Wrapper>
  );
}

function Block({ block, headings }: { block: ContentBlock; headings: LegalHeading[] }) {
  switch (block.type) {
    case "markdown":
      return (
        <Prose>
          <Markdown headings={headings.filter((heading) => heading.blockId === block.id)}>{block.text}</Markdown>
        </Prose>
      );
    case "faq": {
      const titleId = `faq-${block.id}`;
      return (
        <section aria-labelledby={titleId}>
          <h2 id={titleId} className="mb-4 text-heading">
            {block.title}
          </h2>
          <Accordion name={titleId} items={block.items.map((item) => ({ id: item.id, question: item.question, answer: <Markdown>{item.answer}</Markdown> }))} />
        </section>
      );
    }
    case "list":
      return <ListBlockView block={block} />;
  }
}

/** The blocks in order. `legal`: the `## ` headings are numbered sections with anchors (see LegalHeader). */
export function ContentBlocks({ blocks, legal = false }: { blocks: ContentBlock[]; legal?: boolean }) {
  const headings = legal ? legalHeadings(blocks) : [];
  return (
    <div className="space-y-10" data-testid="content-blocks">
      {blocks.map((block) => (
        <Block key={block.id} block={block} headings={headings} />
      ))}
    </div>
  );
}

interface ContentHeaderProps {
  title: string;
  /** Inline Markdown. */
  description: string;
  icon?: React.ReactNode;
  /** "Última actualización: …" (legal pages). */
  meta?: React.ReactNode;
}

/** The page's header from its content: breadcrumbs, h1 and the lead (inline Markdown). */
export function ContentHeader({ title, description, icon, meta }: ContentHeaderProps) {
  return (
    <InfoPageHeader
      icon={icon}
      title={title}
      meta={meta}
      description={
        description ? (
          <span className="[&_a]:font-medium [&_a]:text-info [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:no-underline [&_strong]:font-semibold [&_strong]:text-fg">
            <Markdown inline>{description}</Markdown>
          </span>
        ) : undefined
      }
    />
  );
}

/** A legal page's table of contents: its numbered `## ` sections. */
export function ContentTableOfContents({ blocks }: { blocks: ContentBlock[] }) {
  const headings = legalHeadings(blocks);
  if (headings.length === 0) return null;
  return <TableOfContents items={headings.map((heading) => ({ id: heading.id, title: heading.title }))} />;
}
