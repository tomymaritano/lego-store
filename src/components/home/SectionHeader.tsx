import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  id: string;
  eyebrow?: string;
  /** Eyebrow colour: brand red for deals, blue for everything else. */
  tone?: "info" | "sale";
  title: string;
  description?: ReactNode;
  /** Link or button: on the right on desktop, left-aligned under the title on phones. */
  action?: ReactNode;
}

/**
 * Eyebrow + h2 + blurb that open each home section; fades up into view.
 * Every section uses the same left alignment and the same heading size
 * (text-heading, shared by every product rail in the app).
 */
export function SectionHeader({ id, eyebrow, tone = "info", title, description, action }: SectionHeaderProps) {
  return (
    <Reveal className="mb-10 flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className={cn("text-label tracking-wider uppercase", tone === "sale" ? "text-sale" : "text-info")}>{eyebrow}</p>
        ) : null}
        <h2 id={id} className="mt-2 text-heading">
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-xl text-fg-secondary">{description}</p> : null}
      </div>
      {action}
    </Reveal>
  );
}
