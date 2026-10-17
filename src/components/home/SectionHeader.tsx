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
  /** Link or button on the right (stacks under the title on phones). */
  action?: ReactNode;
  align?: "start" | "center";
}

/** Eyebrow + h2 + blurb that open each home section; fades up into view. */
export function SectionHeader({ id, eyebrow, tone = "info", title, description, action, align = "start" }: SectionHeaderProps) {
  return (
    <Reveal
      className={cn(
        "mb-10 flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between"
      )}
    >
      <div className={cn(align === "center" && "flex flex-col items-center")}>
        {eyebrow ? (
          <p className={cn("text-label tracking-wider uppercase", tone === "sale" ? "text-sale" : "text-info")}>{eyebrow}</p>
        ) : null}
        <h2 id={id} className="mt-2">
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-xl text-fg-secondary">{description}</p> : null}
      </div>
      {action}
    </Reveal>
  );
}
