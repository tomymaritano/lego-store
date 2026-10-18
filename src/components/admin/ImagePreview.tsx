import { ImageOff } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import { isAllowedImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

interface ImagePreviewProps {
  url: string;
  /** What the picture is, for the frame's label ("Imagen principal"). */
  label: string;
  className?: string;
}

/**
 * A product picture as the store will show it (next/image, the placeholder
 * when the file does not load). URLs next/image would refuse are not
 * rendered: the frame says why instead.
 */
export function ImagePreview({ url, label, className }: ImagePreviewProps) {
  const value = url.trim();
  const allowed = value !== "" && isAllowedImageUrl(value);
  return (
    <figure
      className={cn(
        "relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-subtle",
        className
      )}
    >
      {allowed ? (
        <ProductImage src={value} alt={`Vista previa: ${label}`} fill sizes="128px" className="object-contain p-2" />
      ) : (
        <figcaption className="flex flex-col items-center gap-1 p-2 text-center text-caption text-fg-muted">
          <ImageOff aria-hidden="true" className="size-5" />
          {value === "" ? "Sin imagen" : "URL no permitida"}
        </figcaption>
      )}
    </figure>
  );
}
