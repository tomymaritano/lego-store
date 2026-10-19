"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { MAX_FEATURED } from "@/lib/validations/settings-limits";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  showToast,
} from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import type { ConfirmActionResult } from "./ConfirmAction";

export interface FeaturedItem {
  id: string;
  name: string;
  img: string;
  stock: number;
  archived: boolean;
}

interface FeaturedProductsEditorProps {
  initial: FeaturedItem[];
  /** Products on sale (the picker's options), with their picture. */
  options: { id: string; name: string; img?: string }[];
  /** saveFeaturedProductsAction: takes the whole list, in order. */
  action: (productIds: string[]) => Promise<ConfirmActionResult>;
}

type Focus = { id: string; control: "up" | "down" | "remove" } | { id: "picker"; control: "picker" };

/**
 * The home page's "Destacados" (/admin/configuracion): pick products, put
 * them in order with "Subir" / "Bajar" (no dragging needed), take them out,
 * and save the list. The keyboard stays on the moved row's button (or the
 * other one when it reached an end) and a polite live region says the new
 * place; removing a row moves the focus to the picker.
 */
export function FeaturedProductsEditor({ initial, options, action }: FeaturedProductsEditorProps) {
  const [items, setItems] = useState(initial);
  const [choice, setChoice] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const [announcement, setAnnouncement] = useState("");
  const focusNext = useRef<Focus | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pickerRef = useRef<HTMLButtonElement>(null);

  const available = options.filter((option) => !items.some((item) => item.id === option.id));
  const full = items.length >= MAX_FEATURED;
  const optionItems = Object.fromEntries(available.map((option) => [option.id, option.name]));

  useEffect(() => {
    const focus = focusNext.current;
    if (!focus) return;
    focusNext.current = null;
    if (focus.control === "picker") pickerRef.current?.focus();
    else buttons.current.get(`${focus.id}:${focus.control}`)?.focus();
  }, [items]);

  const register = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) buttons.current.set(key, element);
    else buttons.current.delete(key);
  };

  const move = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const item = next[target]!;
    // At an end the pressed button is disabled: the focus goes to the other one.
    const control = (direction === "up" && target === 0) || (direction === "down" && target === next.length - 1) ? (direction === "up" ? "down" : "up") : direction;
    focusNext.current = { id: item.id, control: next.length === 1 ? "remove" : control };
    setItems(next);
    setAnnouncement(`${item.name} quedó en el lugar ${target + 1} de ${next.length}`);
  };

  const remove = (index: number) => {
    const item = items[index]!;
    focusNext.current = { id: "picker", control: "picker" };
    setItems(items.filter((_, i) => i !== index));
    setAnnouncement(`Quitaste ${item.name} de los destacados`);
  };

  const add = () => {
    const option = options.find((candidate) => candidate.id === choice);
    if (!option || full) return;
    setItems([...items, { id: option.id, name: option.name, img: option.img ?? "", stock: 1, archived: false }]);
    setChoice("");
    setAnnouncement(`Agregaste ${option.name} en el lugar ${items.length + 1}`);
  };

  const save = () => {
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await action(items.map((item) => item.id));
        if (result.ok) showToast.success(result.message);
        else showToast.error(result.error);
      } catch {
        showToast.error("No pudimos guardar los destacados. Revisa tu conexión e inténtalo de nuevo.");
      }
    });
  };

  return (
    <Card aria-labelledby="settings-featured" role="region">
      <CardHeader>
        <h2 id="settings-featured" className="text-title text-fg">
          Destacados de la home
        </h2>
        <CardDescription>
          Hasta {MAX_FEATURED} productos, en el orden en que se ven en la sección «Selección de la tienda». Sin productos, la sección no aparece.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {items.length === 0 ? (
          <EmptyState headingLevel="h3" title="Todavía no elegiste destacados" description="Agrega productos con el selector de abajo." />
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border" data-testid="featured-list">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5" data-testid="featured-item">
                <span className="w-6 text-right text-label font-semibold text-fg-muted tabular-nums" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                  {item.img ? <ProductImage src={item.img} alt="" fill sizes="44px" className="object-contain p-1" /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label font-medium text-fg">{item.name}</span>
                  {item.archived ? (
                    <Badge variant="warning" className="w-fit">
                      Archivado: no se muestra
                    </Badge>
                  ) : item.stock === 0 ? (
                    <span className="text-caption text-fg-muted">Sin stock (se muestra igual)</span>
                  ) : null}
                </span>
                <span className="flex gap-1">
                  <IconButton
                    ref={register(`${item.id}:up`)}
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    label={`Subir ${item.name}`}
                    disabled={index === 0 || !hydrated}
                    onClick={() => move(index, "up")}
                  >
                    <ArrowUp aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    ref={register(`${item.id}:down`)}
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    label={`Bajar ${item.name}`}
                    disabled={index === items.length - 1 || !hydrated}
                    onClick={() => move(index, "down")}
                  >
                    <ArrowDown aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    ref={register(`${item.id}:remove`)}
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    label={`Quitar ${item.name}`}
                    disabled={!hydrated}
                    onClick={() => remove(index)}
                  >
                    <X aria-hidden="true" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ol>
        )}
        <span role="status" className="sr-only" data-testid="featured-announcement">
          {announcement}
        </span>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Agregar un producto" className="min-w-0 flex-1" hint={full ? `Ya hay ${MAX_FEATURED}: quita uno para agregar otro.` : undefined}>
            <Select items={optionItems} value={choice || null} onValueChange={(value) => setChoice(typeof value === "string" ? value : "")} disabled={full}>
              <SelectTrigger ref={pickerRef}>
                <SelectValue placeholder="Elige un producto" />
              </SelectTrigger>
              <SelectContent>
                {available.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="button" variant="secondary" onClick={add} disabled={!choice || full || !hydrated}>
            <Plus aria-hidden="true" />
            Agregar
          </Button>
        </div>

        <Button type="button" onClick={save} loading={pending} disabled={!hydrated} data-testid="featured-save">
          {pending ? null : <Save aria-hidden="true" />}
          {pending ? "Guardando…" : "Guardar destacados"}
        </Button>
      </CardContent>
    </Card>
  );
}
