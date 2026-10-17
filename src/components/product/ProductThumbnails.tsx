"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

interface ProductThumbnailsProps {
  images: string[];
  selected: number;
  onSelect: (index: number) => void;
  productName: string;
  size?: "sm" | "md";
  className?: string;
}

/** Image picker for a product gallery (toggle buttons, current one pressed). */
export function ProductThumbnails({
  images,
  selected,
  onSelect,
  productName,
  size = "md",
  className,
}: ProductThumbnailsProps) {
  if (images.length < 2) return null;

  return (
    <div role="group" aria-label={`Imágenes de ${productName}`} className={cn("flex gap-3 overflow-x-auto p-1 scrollbar-hide", className)}>
      {images.map((src, index) => (
        <Button
          key={src}
          variant="secondary"
          onClick={() => onSelect(index)}
          aria-label={`Ver imagen ${index + 1} de ${images.length}`}
          aria-pressed={selected === index}
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xl border-2 bg-surface p-0 hover:bg-surface",
            size === "sm" ? "size-16" : "size-20",
            selected === index ? "border-primary shadow-md" : "border-transparent hover:border-border-strong"
          )}
        >
          <Image src={src} alt="" fill sizes="80px" className="object-contain p-2" />
        </Button>
      ))}
    </div>
  );
}
