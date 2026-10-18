import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Data table (shadcn/ui's Table, re-tokenised). Plain semantic HTML: a
 * <table> with <caption>, <thead>/<th scope="col"> and <tbody>, so screen
 * readers announce headers per cell.
 *
 * Wide tables scroll sideways inside their own frame on narrow screens. That
 * frame is a focusable, labelled region (`label`), so keyboard users can
 * scroll it too (axe: scrollable-region-focusable).
 */

interface TableProps extends React.ComponentProps<"table"> {
  /** Accessible name of the scrolling frame (e.g. "Pedidos"). */
  label: string;
  /** Classes for the scrolling frame. */
  containerClassName?: string;
}

function Table({ label, className, containerClassName, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "relative w-full overflow-x-auto rounded-2xl border border-border bg-surface",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        containerClassName
      )}
    >
      <table data-slot="table" className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("bg-bg-subtle [&_tr]:border-b [&_tr]:border-border", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot data-slot="table-footer" className={cn("border-t border-border bg-bg-subtle font-medium", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b border-border transition-colors duration-fast ease-standard hover:bg-bg-subtle/60", className)}
      {...props}
    />
  );
}

function TableHead({ className, scope = "col", ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn("h-11 px-4 text-left align-middle text-xs font-bold tracking-wide whitespace-nowrap text-fg-secondary uppercase", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-4 py-3 align-middle text-fg", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("px-4 py-3 text-left text-xs text-fg-muted", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption };
