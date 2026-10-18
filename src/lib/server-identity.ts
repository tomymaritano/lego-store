import { createHash } from "node:crypto";
import path from "node:path";

/**
 * Which checkout and database a dev server runs with, as a short hash of its
 * folder and DATABASE_URL (neither leaves the machine in clear). The e2e
 * global setup (e2e/global-setup.ts) compares it with its own before reusing a
 * server already listening on the e2e port: a `next dev` from another checkout,
 * or one on another database, would make the specs read and write a database
 * the server does not use. Served only with the payments mock
 * (src/app/api/test/identity/route.ts), never by a production build.
 */
export function serverIdentity(cwd: string, databaseUrl: string | undefined): string {
  let folder = path.resolve(cwd);
  // Windows paths are case-insensitive: "C:\Users" and "c:\users" are the same checkout.
  if (process.platform === "win32") folder = folder.toLowerCase();
  return createHash("sha256")
    .update(`${folder}\n${databaseUrl?.trim() ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}
