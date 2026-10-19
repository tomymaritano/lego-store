"use client";

import { useId, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { IconButton, Input, showToast } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StockQuickEditProps {
  productId: string;
  productName: string;
  stock: number;
  /** updateStockAction (src/lib/admin/actions.ts). */
  action: (productId: string, stock: string, seen: number) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  className?: string;
}

/**
 * The stock of one product, editable in place (products list, dashboard):
 * type the new number and press Enter or the check button. The server
 * validates it again and only writes it while the stock is still the one
 * shown (a sale in between is reported, never undone); a toast reports the
 * result, and the page re-renders with the saved value.
 */
export function StockQuickEdit({ productId, productName, stock, action, className }: StockQuickEditProps) {
  const [value, setValue] = useState(String(stock));
  const [saved, setSaved] = useState(stock);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  // The page re-rendered with another value (someone else saved, a purchase took units): follow it.
  if (stock !== saved) {
    setSaved(stock);
    setValue(String(stock));
  }
  const dirty = value.trim() !== String(saved);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty || pending) return;
    startTransition(async () => {
      try {
        const result = await action(productId, value.trim(), saved);
        if (result.ok) showToast.success(`${productName}: ${result.message.toLowerCase()}`);
        else {
          showToast.error(result.error);
          setValue(String(saved));
        }
      } catch {
        showToast.error("No pudimos guardar el stock. Revisa tu conexión e inténtalo de nuevo.");
        setValue(String(saved));
      }
    });
  };

  return (
    <form onSubmit={submit} className={cn("flex items-center gap-1.5", className)} data-testid="stock-quick-edit">
      <label htmlFor={inputId} className="sr-only">
        Stock de {productName}
      </label>
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-9 w-20 px-2 text-right tabular-nums"
        aria-busy={pending || undefined}
      />
      <IconButton
        type="submit"
        size="icon-sm"
        variant={dirty ? "primary" : "ghost"}
        label={`Guardar stock de ${productName}`}
        disabled={!dirty}
        loading={pending}
      >
        <Check aria-hidden="true" />
      </IconButton>
    </form>
  );
}
