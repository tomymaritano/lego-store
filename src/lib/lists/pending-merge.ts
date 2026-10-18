import { mergeListsSchema, type MergeListsInput } from "@/lib/validations/lists";

/*
 * The login merge a browser has sent but not seen answered yet (client only).
 * Kept in localStorage until the merged lists are adopted, so a retry (the
 * next sync, the next page load) resends the very same guest lists with the
 * same token, and the server adds them at most once (src/lib/lists/merge.ts).
 * Falls back to memory when storage is unavailable.
 */

const KEY = "lego-lists-merge";

let inMemory: MergeListsInput | null = null;

export function readPendingMerge(): MergeListsInput | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed = mergeListsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return inMemory;
  }
}

export function writePendingMerge(merge: MergeListsInput | null): void {
  inMemory = merge;
  try {
    if (merge) window.localStorage.setItem(KEY, JSON.stringify(merge));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Memory only: a reload before the answer would merge again with a new token.
  }
}

/** A random token for a new merge (randomUUID needs a secure context; plain random bytes otherwise). */
export function newMergeToken(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
