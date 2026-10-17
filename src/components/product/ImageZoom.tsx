"use client";

import { useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { AnimatePresence, m } from "motion/react";
import { ZoomIn } from "lucide-react";
import { scaleIn } from "@/lib/motion";
import { PLACEHOLDER_IMAGE, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui";

interface ImageZoomProps {
  src: string;
  alt: string;
  className?: string;
}

const LENS = 128;

/**
 * Main product picture. With a mouse, a round lens magnifies the spot under
 * the pointer; any click, tap or Enter opens the picture full size in a
 * Dialog (focus trap, Escape, focus return). A missing file falls back to
 * the store placeholder, and then the lens is skipped.
 */
export function ImageZoom({ src, alt, className }: ImageZoomProps) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  const shown = failed ? PLACEHOLDER_IMAGE : src;
  const [lens, setLens] = useState<{ x: number; y: number; px: number; py: number } | null>(null);

  const handleMouseMove = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || failed) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setLens({ x, y, px: (x / rect.width) * 100, py: (y / rect.height) * 100 });
  };

  return (
    <Dialog>
      <DialogTrigger
        ref={containerRef}
        aria-label={`Ampliar imagen: ${alt}`}
        className={cn(
          "group relative block cursor-zoom-in overflow-hidden rounded-[inherit] outline-none",
          "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
          className
        )}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setLens(null)}
      >
        <Image
          src={shown}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain p-8 transition-[scale] duration-slow ease-emphasized group-hover:scale-105 motion-reduce:group-hover:scale-100"
          onError={() => setFailedSrc(src)}
          preload
        />

        <AnimatePresence>
          {lens && (
            <m.span
              aria-hidden="true"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-none absolute size-32 overflow-hidden rounded-full border-2 border-surface bg-surface shadow-lg"
              style={{ left: lens.x - LENS / 2, top: lens.y - LENS / 2 }}
            >
              <span
                className="absolute size-[400%] bg-cover bg-no-repeat"
                style={{
                  backgroundImage: `url(${shown})`,
                  backgroundPosition: `${lens.px}% ${lens.py}%`,
                  transform: "translate(-37.5%, -37.5%)",
                }}
              />
            </m.span>
          )}
        </AnimatePresence>

        <span
          aria-hidden="true"
          className="absolute right-4 bottom-4 flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1.5 text-sm font-medium text-fg shadow-md transition-opacity duration-base ease-standard pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-visible:opacity-100"
        >
          <ZoomIn className="size-4" />
          Ampliar
        </span>
      </DialogTrigger>

      <DialogContent className="h-[calc(100dvh-2rem)] max-w-5xl p-4 sm:p-6" closeLabel="Cerrar imagen ampliada">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative min-h-0 flex-1">
          <Image src={shown} alt={alt} fill sizes="100vw" className="object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
