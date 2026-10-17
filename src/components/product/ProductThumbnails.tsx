"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

/**
 * Gallery images minus the ones that failed to load, plus the selected one
 * (tracked by src so it survives an earlier image dropping out). The first
 * image always stays so the gallery never ends up empty.
 */
export function useGalleryImages(images: readonly string[]) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedSrc, setSelectedSrc] = useState<string | undefined>(images[0]);

  const visible = images.filter((src, index) => index === 0 || !failed.has(src));
  const selected = Math.max(0, visible.indexOf(selectedSrc ?? ""));

  return {
    images: visible,
    selected,
    selectedSrc: visible[selected] ?? images[0] ?? "",
    select: (index: number) => setSelectedSrc(visible[index]),
    markFailed: (src: string) => setFailed((prev) => (prev.has(src) ? prev : new Set(prev).add(src))),
  };
}

interface ProductThumbnailsProps {
  images: string[];
  selected: number;
  onSelect: (index: number) => void;
  /** Called when a thumbnail cannot load, so the gallery can drop that image. */
  onImageError?: (src: string) => void;
  productName: string;
  size?: "sm" | "md";
  className?: string;
}

const KEY_STEP: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

/**
 * Image picker for a product gallery: toggle buttons (current one pressed).
 * Every thumbnail is a Tab stop; arrow keys, Home and End also move between
 * them and show the picture straight away.
 */
export function ProductThumbnails({
  images,
  selected,
  onSelect,
  onImageError,
  productName,
  size = "md",
  className,
}: ProductThumbnailsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  if (images.length < 2) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEP[event.key];
    const current = buttons.current.findIndex((button) => button === document.activeElement);
    if (!step || current === -1) return;
    event.preventDefault();
    const next = step(current, images.length);
    onSelect(next);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={`Imágenes de ${productName}`}
      onKeyDown={handleKeyDown}
      className={cn("flex gap-3 overflow-x-auto p-1 scrollbar-hide", className)}
    >
      {images.map((src, index) => (
        <Button
          key={src}
          ref={(element: HTMLButtonElement | null) => {
            buttons.current[index] = element;
          }}
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
          <Image src={src} alt="" fill sizes="80px" className="object-contain p-2" onError={() => onImageError?.(src)} />
        </Button>
      ))}
    </div>
  );
}
