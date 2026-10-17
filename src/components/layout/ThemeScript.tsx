"use client";

import { useSyncExternalStore } from "react";
import { THEME_SCRIPT } from "@/lib/theme";

const subscribe = () => () => {};

/**
 * The inline <head> script that applies the saved theme before first paint
 * (see lib/theme.ts). It only matters in server-rendered HTML, so it renders
 * only there and while hydrating it:
 *
 * - server render and hydration read the server snapshot (true): the script
 *   is in the HTML and runs before paint, and hydration matches it;
 * - a client-only render of the root layout reads the client snapshot
 *   (false) and renders nothing. That happens when a page calls forbidden()
 *   or notFound() outside a Suspense boundary: Next sends an error shell and
 *   the browser renders the whole tree with createRoot, where React would
 *   warn that a <script> rendered on the client never runs.
 *
 * After hydration it re-renders with the client snapshot and drops the
 * already-executed node; ThemeSync takes over from there.
 */
export function ThemeScript() {
  const serverHtml = useSyncExternalStore(
    subscribe,
    () => false,
    () => true
  );
  return serverHtml ? <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /> : null;
}
