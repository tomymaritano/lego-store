import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface AccordionItem {
  /** React key; the question when left out. */
  id?: string;
  question: string;
  answer: ReactNode;
}

/**
 * Native <details> disclosures: keyboard and screen-reader support for free,
 * works without JavaScript (Server Component). Opening animates the height
 * where the browser supports ::details-content (see .disclosure in globals.css).
 */
export function Accordion({ items, name }: { items: AccordionItem[]; name?: string }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      {items.map((item) => (
        <details key={item.id ?? item.question} name={name} className="disclosure group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-fg transition-colors duration-fast ease-standard hover:bg-bg-subtle focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 text-fg-muted transition-[rotate] duration-base ease-standard group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5 text-fg-secondary [&_a]:font-medium [&_a]:text-info [&_a]:underline [&_a]:underline-offset-4">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
