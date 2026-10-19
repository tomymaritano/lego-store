"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Who is signed in, as the client islands need it (the root layout checks the session on the server). */
export interface Viewer {
  id: string;
  name: string | null;
}

const ViewerContext = createContext<Viewer | null>(null);

/**
 * Makes the signed-in user (or null) available to client islands from the
 * first render, server HTML included, so nothing flashes a signed-out state.
 * The layout re-renders on login and logout (both redirect), which updates it.
 * Only a hint for the UI: every Server Action and Route Handler checks the
 * session again.
 */
export function ViewerProvider({ viewer, children }: { viewer: Viewer | null; children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer | null {
  return useContext(ViewerContext);
}
