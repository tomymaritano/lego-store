"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImageUp, TriangleAlert, X } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, UPLOAD_ERRORS, UPLOAD_KIND_LABEL } from "@/lib/uploads/validate";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui";

export interface UploadedImage {
  url: string;
  width: number | null;
  height: number | null;
}

interface Pending {
  id: number;
  name: string;
  /** A local preview while it uploads (an object URL). */
  preview: string;
  /** 0..1 of the bytes sent. */
  progress: number;
  error: string | null;
}

/** POSTs one file to /api/admin/uploads, reporting the upload's progress. */
export function uploadImage(file: File, onProgress: (fraction: number) => void): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/uploads");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const body = (request.response ?? {}) as Partial<UploadedImage> & { error?: string };
      if (request.status === 201 && typeof body.url === "string") resolve({ url: body.url, width: body.width ?? null, height: body.height ?? null });
      else reject(new Error(body.error ?? "No pudimos subir la imagen. Inténtalo de nuevo."));
    };
    request.onerror = () => reject(new Error("No pudimos subir la imagen. Revisa tu conexión e inténtalo de nuevo."));
    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}

/** What the browser can tell before sending (the server checks the bytes again). */
function precheck(file: File): string | null {
  if (file.size === 0) return UPLOAD_ERRORS.empty;
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_ERRORS.too_large;
  if (file.type && !UPLOAD_ACCEPT.split(",").includes(file.type)) return UPLOAD_ERRORS.unsupported;
  return null;
}

/** Why some of the chosen files were not uploaded: only `room` more fit. */
function skippedMessage(room: number, left: number): string {
  if (room === 0) return "No queda lugar para más imágenes: no subimos ninguna.";
  const others = left === 1 ? "la otra" : `las otras ${left}`;
  return room === 1
    ? `Solo entra 1 imagen más: subimos la primera y no ${others}.`
    : `Solo entran ${room} imágenes más: subimos las primeras ${room} y no ${others}.`;
}

interface ImageUploaderProps {
  /**
   * Called once per picture that finished uploading, in the order they were
   * chosen. Returning a message means the form did not take it (a duplicate,
   * no room left): the uploader shows it on that file instead of "Subimos".
   */
  onUploaded: (image: UploadedImage) => string | void;
  multiple?: boolean;
  /** How many more pictures fit: extra files chosen at once are not uploaded, and the uploader says so. */
  maxFiles?: number;
  /** The visible button ("Subir imágenes"). */
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Picture upload for the admin forms: a drop zone with a button (the
 * keyboard and screen-reader way in; dragging files onto it is the mouse
 * shortcut). Each file shows its local preview and a progress bar while it
 * goes up, and its error if the server refuses it (size, format: JPG, PNG,
 * WebP or AVIF, decided by its bytes). The form gets the stored URL through
 * `onUploaded`.
 */
export function ImageUploader({ onUploaded, multiple = false, maxFiles, label, disabled = false, className }: ImageUploaderProps) {
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [skipped, setSkipped] = useState<string | null>(null);
  const counter = useRef(0);
  /** Files chosen and not finished yet: they take room that maxFiles counts. */
  const inFlight = useRef(0);
  const hydrated = useHydrated();
  const busy = pending.some((item) => item.error === null);

  // Object URLs are freed when the uploader goes away.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const update = (id: number, patch: Partial<Pending>) => setPending((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const dismiss = (id: number) =>
    setPending((items) => {
      const item = items.find((entry) => entry.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
        previews.current.delete(item.preview);
      }
      return items.filter((entry) => entry.id !== id);
    });

  async function start(files: File[]) {
    let chosen = multiple ? files : files.slice(0, 1);
    const room = maxFiles === undefined ? chosen.length : Math.max(0, maxFiles - inFlight.current);
    if (chosen.length > room) {
      const left = chosen.length - room;
      const message = skippedMessage(room, left);
      setSkipped(message);
      setAnnouncement(message);
      chosen = chosen.slice(0, room);
    } else {
      setSkipped(null);
    }
    inFlight.current += chosen.length;
    const jobs = chosen.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { file, item: { id: ++counter.current, name: file.name, preview, progress: 0, error: precheck(file) } satisfies Pending };
    });
    setPending((items) => [...items, ...jobs.map((job) => job.item)]);
    // One after another: the gallery keeps the order they were chosen in.
    for (const { file, item } of jobs) {
      if (item.error) {
        inFlight.current -= 1;
        continue;
      }
      try {
        const uploaded = await uploadImage(file, (progress) => update(item.id, { progress }));
        const refused = onUploaded(uploaded);
        if (refused) {
          update(item.id, { error: refused });
          setAnnouncement(`${file.name}: ${refused}`);
        } else {
          dismiss(item.id);
          setAnnouncement(`Subimos ${file.name}.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "No pudimos subir la imagen.";
        update(item.id, { error: message });
        setAnnouncement(`${file.name}: ${message}`);
      } finally {
        inFlight.current -= 1;
      }
    }
  }

  const choose = (list: FileList | null) => {
    if (list && list.length > 0) void start(Array.from(list));
    if (input.current) input.current.value = "";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) choose(event.dataTransfer.files);
        }}
        className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-strong bg-bg-subtle px-4 py-6 text-center transition-colors duration-fast ease-standard data-dragging:border-primary data-dragging:bg-primary/10"
      >
        <ImageUp aria-hidden="true" className="size-6 text-fg-muted" />
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          aria-describedby={hintId}
          aria-label={label}
          disabled={disabled || !hydrated}
          onChange={(event) => choose(event.target.files)}
          data-testid="image-upload-input"
        />
        <Button type="button" variant="secondary" size="sm" disabled={disabled || !hydrated} loading={busy} aria-describedby={hintId} onClick={() => input.current?.click()}>
          {label}
        </Button>
        <p id={hintId} className="text-caption text-fg-muted">
          {multiple ? "O arrastra las imágenes acá." : "O arrástrala acá."} {UPLOAD_KIND_LABEL}, hasta {MAX_UPLOAD_BYTES / 1024 / 1024} MB.
        </p>
      </div>

      {skipped ? (
        <p className="flex items-start gap-1.5 text-caption text-fg-secondary" data-testid="image-upload-skipped">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {skipped}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-2" aria-label="Imágenes subiendo">
          {pending.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2" data-testid="image-upload-pending">
              {/* A local blob: preview, so a plain img (next/image cannot load object URLs). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt="" className="size-12 shrink-0 rounded-lg bg-bg-subtle object-contain" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate text-label font-medium text-fg">{item.name}</p>
                {item.error ? (
                  <p className="flex items-start gap-1.5 text-caption text-danger">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    {item.error}
                  </p>
                ) : (
                  <div
                    role="progressbar"
                    aria-label={`Subiendo ${item.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                    className="h-1.5 overflow-hidden rounded-full bg-bg-muted"
                  >
                    <div className="h-full origin-left rounded-full bg-primary transition-[scale] duration-fast ease-standard" style={{ scale: `${item.progress} 1` }} />
                  </div>
                )}
              </div>
              {item.error ? (
                <IconButton type="button" size="icon-sm" label={`Descartar ${item.name}`} onClick={() => dismiss(item.id)}>
                  <X aria-hidden="true" />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
