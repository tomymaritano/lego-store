"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { dropDown } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { NavItem } from "@/config/navigation";

/**
 * "Temas" disclosure in the desktop nav: a button that shows a list of links
 * (disclosure pattern, not an ARIA menu, so links keep their semantics).
 * Opens on hover or click; Escape and focus leaving it close it.
 */
export function ThemesMenu({ themes, triggerClassName }: { themes: NavItem[]; triggerClassName?: string }) {
  const listId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          (event.currentTarget.querySelector("button") as HTMLButtonElement | null)?.focus();
        }
      }}
    >
      <Button
        variant="ghost"
        className={triggerClassName}
        aria-expanded={open}
        aria-controls={listId}
        // Keyboard (detail 0) toggles; a mouse click after hover-open keeps it open.
        onClick={(event) => setOpen((value) => (event.detail === 0 ? !value : true))}
      >
        Temas
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-[rotate] duration-fast ease-standard", open && "rotate-180")}
        />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            variants={dropDown}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full left-0 z-50 w-52 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl"
          >
            {themes.map((theme) => (
              <li key={theme.href}>
                <Link
                  href={theme.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg focus-visible:bg-bg-muted focus-visible:text-fg"
                >
                  {theme.name}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
