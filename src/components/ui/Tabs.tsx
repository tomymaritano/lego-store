"use client";

import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

type WithClassName<T> = Omit<T, "className"> & { className?: string };

function Tabs({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseTabs.Root>>) {
  return <BaseTabs.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />;
}

/** Tab list with an animated underline that slides to the active tab. */
function TabsList({ className, children, ...props }: WithClassName<React.ComponentProps<typeof BaseTabs.List>>) {
  return (
    <BaseTabs.List
      data-slot="tabs-list"
      className={cn("relative flex gap-1 overflow-x-auto border-b border-border scrollbar-hide", className)}
      {...props}
    >
      {children}
      <BaseTabs.Indicator
        className={cn(
          "absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-primary",
          "transition-[translate,width] duration-base ease-emphasized"
        )}
      />
    </BaseTabs.List>
  );
}

function TabsTrigger({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseTabs.Tab>>) {
  return (
    <BaseTabs.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg px-4 text-sm font-semibold whitespace-nowrap text-fg-muted",
        "transition-colors duration-fast ease-standard hover:text-fg",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
        "data-active:text-fg data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: WithClassName<React.ComponentProps<typeof BaseTabs.Panel>>) {
  return (
    <BaseTabs.Panel
      data-slot="tabs-content"
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-lg", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
