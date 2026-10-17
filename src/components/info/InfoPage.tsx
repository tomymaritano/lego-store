import type { ComponentProps, ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui";
import { cn } from "@/lib/utils";

interface InfoPageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Decorative lucide icon shown in a LEGO-yellow tile. */
  icon?: ReactNode;
  /** Small line under the description, e.g. "Última actualización: …". */
  meta?: ReactNode;
}

/** Breadcrumbs + h1 + lead for the static info pages (FAQ, envíos, términos…). */
export function InfoPageHeader({ title, description, icon, meta }: InfoPageHeaderProps) {
  return (
    <header className="mb-10">
      <Breadcrumbs items={[{ label: title }]} className="pt-0" />
      <div className="flex items-start gap-4">
        {icon ? (
          <span
            aria-hidden="true"
            className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm sm:flex [&_svg]:size-7"
          >
            {icon}
          </span>
        ) : null}
        <div>
          <h1 className="text-3xl md:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-lg text-fg-secondary">{description}</p> : null}
          {meta ? <p className="mt-2 text-sm text-fg-muted">{meta}</p> : null}
        </div>
      </div>
    </header>
  );
}

/** Long-form text styles (headings, lists, links) on tokens. */
export function Prose({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-3xl space-y-4 text-body text-fg-secondary",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2:first-child]:mt-0",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg",
        "[&_strong]:font-semibold [&_strong]:text-fg",
        "[&_a]:rounded-sm [&_a]:font-medium [&_a]:text-info [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:no-underline",
        "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_li]:marker:text-fg-muted",
        className
      )}
      {...props}
    />
  );
}

/** Highlighted fact tile ("Envío gratis desde $5.000"). */
export function FactCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-bg-muted text-info [&_svg]:size-5"
      >
        {icon}
      </span>
      <div>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <p className="mt-1 text-sm text-fg-secondary">{children}</p>
      </div>
    </li>
  );
}

/** Table of contents for the legal pages (anchors to each h2). */
export function TableOfContents({ items }: { items: { id: string; title: string }[] }) {
  return (
    <nav aria-label="En esta página" className="mb-10 rounded-2xl border border-border bg-bg-subtle p-5">
      <h2 className="mb-3 text-sm font-bold tracking-wider text-fg uppercase">En esta página</h2>
      <ol className="grid list-decimal gap-x-8 gap-y-1.5 pl-5 text-sm sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="marker:text-fg-muted">
            <a
              href={`#${item.id}`}
              className="rounded-sm text-fg-secondary underline-offset-4 transition-colors duration-fast ease-standard hover:text-fg hover:underline"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
