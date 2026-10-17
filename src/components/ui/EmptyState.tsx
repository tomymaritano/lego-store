import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Decorative icon (lucide component instance). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action, usually a <Button>. */
  action?: React.ReactNode;
  /** Heading level for the title, to fit the page outline. */
  headingLevel?: "h2" | "h3";
}

export function EmptyState({ icon, title, description, action, headingLevel = "h2", className, ...props }: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}
      {...props}
    >
      {icon ? (
        <div aria-hidden="true" className="mb-2 flex size-20 items-center justify-center rounded-full bg-bg-muted text-fg-muted [&_svg]:size-9">
          {icon}
        </div>
      ) : null}
      <Heading className="text-title text-fg">{title}</Heading>
      {description ? <p className="max-w-sm text-body text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
