"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Link2, Star, Trash2 } from "lucide-react";
import { isAllowedImageUrl } from "@/lib/images";
import { IMAGE_RULE, MAX_IMAGE_ALT, MAX_PRODUCT_IMAGES, type GalleryImage } from "@/lib/validations/admin";
import { Badge, Button, Field, IconButton, Input } from "@/components/ui";
import { ImagePreview } from "./ImagePreview";
import { ImageUploader } from "./ImageUploader";

interface Item extends GalleryImage {
  key: number;
}

interface GalleryEditorProps {
  /** The hidden field the form submits (JSON list of { url, alt }). */
  name: string;
  initial: GalleryImage[];
  /** The server's message for the gallery (it names the picture). */
  error?: string;
}

/**
 * A product's pictures, in order: the first is the main one (cards, cart,
 * search) and the rest follow it in the product page's gallery. Pictures
 * come from an upload (several at once, by button or drag and drop) or a
 * pasted URL; each one needs its alt text, can move up or down, become the
 * main one, or go. What the form submits is the list as JSON; the server
 * validates it again (src/lib/validations/admin.ts).
 */
export function GalleryEditor({ name, initial, error }: GalleryEditorProps) {
  const [items, setItems] = useState<Item[]>(() => initial.map((image, index) => ({ ...image, key: index })));
  // Keys of pictures added later continue after the initial ones.
  const counter = useRef(initial.length);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const altInputs = useRef(new Map<number, HTMLInputElement>());
  const full = items.length >= MAX_PRODUCT_IMAGES;

  const add = (image: GalleryImage) => {
    const key = ++counter.current;
    setItems((list) => (list.length >= MAX_PRODUCT_IMAGES || list.some((item) => item.url === image.url) ? list : [...list, { ...image, key }]));
    // The alt text is what is missing next: its field gets the focus.
    requestAnimationFrame(() => altInputs.current.get(key)?.focus());
  };

  const move = (index: number, to: number) =>
    setItems((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item!);
      return next;
    });

  const addUrl = () => {
    const value = url.trim();
    if (!isAllowedImageUrl(value)) {
      setUrlError(IMAGE_RULE);
      return;
    }
    if (items.some((item) => item.url === value)) {
      setUrlError("Esa imagen ya está en la galería.");
      return;
    }
    setUrlError(null);
    setUrl("");
    add({ url: value, alt: "" });
  };

  return (
    <div className="space-y-5" data-testid="gallery-editor">
      <input type="hidden" name={name} value={JSON.stringify(items.map(({ url: itemUrl, alt }) => ({ url: itemUrl, alt })))} />
      {error ? (
        <p role="alert" className="text-label font-medium text-danger" data-testid="gallery-error">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary">
          Todavía no hay imágenes. Sube al menos una: la primera es la principal.
        </p>
      ) : (
        <ol aria-label="Imágenes del producto" className="space-y-3">
          {items.map((item, index) => {
            const position = index === 0 ? "Imagen principal" : `Imagen ${index + 1}`;
            return (
              <li key={item.key} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-start" data-testid="gallery-item">
                <ImagePreview url={item.url} label={position} className="size-24 self-center sm:self-start" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold text-fg">{position}</span>
                    {index === 0 ? <Badge variant="success">Principal</Badge> : null}
                  </div>
                  <p className="truncate font-mono text-caption text-fg-muted" title={item.url}>
                    {item.url}
                  </p>
                  <Field label={`Texto alternativo (${position.toLowerCase()})`} hint="Qué se ve en la imagen, para quien no la ve." required>
                    <Input
                      ref={(element) => {
                        if (element) altInputs.current.set(item.key, element);
                        else altInputs.current.delete(item.key);
                      }}
                      value={item.alt}
                      maxLength={MAX_IMAGE_ALT}
                      autoComplete="off"
                      onChange={(event) => {
                        const alt = event.target.value;
                        setItems((list) => list.map((entry) => (entry.key === item.key ? { ...entry, alt } : entry)));
                      }}
                    />
                  </Field>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1 sm:flex-col">
                  <IconButton type="button" size="icon-sm" variant="ghost" label={`Mover antes: ${position.toLowerCase()}`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                    <ArrowUp aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    label={`Mover después: ${position.toLowerCase()}`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </IconButton>
                  {index > 0 ? (
                    <IconButton type="button" size="icon-sm" variant="ghost" label={`Hacer principal: ${position.toLowerCase()}`} onClick={() => move(index, 0)}>
                      <Star aria-hidden="true" />
                    </IconButton>
                  ) : null}
                  <IconButton
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    label={`Quitar: ${position.toLowerCase()}`}
                    onClick={() => setItems((list) => list.filter((entry) => entry.key !== item.key))}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ImageUploader
        multiple
        label="Subir imágenes"
        disabled={full}
        onUploaded={(image) => add({ url: image.url, alt: "" })}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="O pega una URL" error={urlError ?? undefined} hint={full ? `Ya tiene ${MAX_PRODUCT_IMAGES} imágenes, el máximo.` : undefined} className="min-w-0 flex-1">
          <Input
            type="url"
            value={url}
            disabled={full}
            autoComplete="off"
            placeholder="https://www.lego.com/cdn/… o /images/…"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addUrl();
              }
            }}
          />
        </Field>
        <Button type="button" variant="secondary" size="sm" disabled={full || url.trim() === ""} onClick={addUrl} className="sm:mb-0.5">
          <Link2 aria-hidden="true" />
          Agregar
        </Button>
      </div>
    </div>
  );
}
