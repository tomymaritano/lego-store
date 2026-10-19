"use client";

import { useState } from "react";
import { MAX_IMAGE_ALT } from "@/lib/validations/admin";
import { Field, Input } from "@/components/ui";
import { ImagePreview } from "./ImagePreview";
import { ImageUploader } from "./ImageUploader";

interface ImageFieldProps {
  /** Form field of the URL. */
  name: string;
  label: string;
  initialUrl: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Form field of the alt text, when the picture needs one (a category's image). */
  alt?: { name: string; initial: string; error?: string };
}

/**
 * One picture of a form (a category's image, a product's hover image): an
 * upload, or the URL typed or pasted by hand, previewed as the store shows
 * it, with its alt text when it has one. Uploading fills the URL field.
 */
export function ImageField({ name, label, initialUrl, error, hint, required = false, alt }: ImageFieldProps) {
  const [url, setUrl] = useState(initialUrl);
  const [altText, setAltText] = useState(alt?.initial ?? "");
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <Field label={label} error={error} hint={hint ?? "Sube una imagen o pega su URL."} required={required}>
            <Input name={name} type="url" value={url} onChange={(event) => setUrl(event.target.value)} autoComplete="off" />
          </Field>
          {alt ? (
            <Field label="Texto alternativo" error={alt.error} hint="Qué se ve en la imagen, para quien no la ve." required>
              <Input name={alt.name} value={altText} maxLength={MAX_IMAGE_ALT} onChange={(event) => setAltText(event.target.value)} autoComplete="off" />
            </Field>
          ) : null}
        </div>
        <ImagePreview url={url} label={label} className="mt-7 size-20 sm:size-24" />
      </div>
      <ImageUploader label="Subir imagen" onUploaded={(image) => setUrl(image.url)} />
    </div>
  );
}
