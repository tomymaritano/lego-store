import type { ReactNode } from "react";
import { PageTransition } from "@/components/layout";

/** Remounts on every top-level navigation, so each page gets the enter transition. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
