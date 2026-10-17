"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui";
import { SearchAutocomplete } from "@/components/search";

/**
 * Full-screen search for phones: a top Sheet (focus trap, Escape, focus
 * return) with the combobox and its suggestions laid out inline.
 */
export function MobileSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" closeLabel="Cerrar búsqueda" className="h-dvh">
        <SheetHeader>
          <SheetTitle>Buscar</SheetTitle>
        </SheetHeader>
        <SearchAutocomplete
          variant="inline"
          autoFocus
          onClose={() => onOpenChange(false)}
          className="flex min-h-0 flex-1 flex-col"
        />
      </SheetContent>
    </Sheet>
  );
}
