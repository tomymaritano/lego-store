"use client";

import { useState, type ComponentProps } from "react";
import Image from "next/image";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";

type ProductImageProps = Omit<ComponentProps<typeof Image>, "onError">;

/**
 * next/image for catalogue pictures that falls back to the LEGO placeholder
 * when the file is missing, instead of leaving an empty frame. Usable from
 * Server Components (it is a tiny client island).
 */
export function ProductImage({ src, alt, ...props }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<ProductImageProps["src"] | null>(null);
  const failed = failedSrc !== null && failedSrc === src;
  return <Image {...props} alt={alt} src={failed ? PLACEHOLDER_IMAGE : src} onError={() => setFailedSrc(src)} />;
}
