/*
 * The public hostname of this store's own Vercel Blob store, where the
 * admin's uploads live in production: "<store id>.public.blob.vercel-storage.com".
 *
 * next.config.mjs allows only this host in images.remotePatterns (and hands it
 * to the app as BLOB_PUBLIC_HOSTNAME for src/lib/images.ts). A wildcard over
 * every Blob store would make /_next/image fetch, resize and serve pictures
 * from anybody's public store, on this store's quota and from its origin.
 *
 * Plain JavaScript: next.config.mjs imports it.
 */

const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

/**
 * BLOB_PUBLIC_HOSTNAME when set (and valid); otherwise the store id inside
 * BLOB_READ_WRITE_TOKEN ("vercel_blob_rw_<store id>_<secret>", the format
 * @vercel/blob reads); otherwise null (no Blob store: uploads go to disk).
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function blobPublicHostname(env) {
  const explicit = env.BLOB_PUBLIC_HOSTNAME?.trim().toLowerCase();
  if (explicit) {
    if (!BLOB_HOST.test(explicit)) {
      throw new Error(`BLOB_PUBLIC_HOSTNAME no es un host de Vercel Blob ("<id>.public.blob.vercel-storage.com"): ${explicit}`);
    }
    return explicit;
  }
  const storeId = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(env.BLOB_READ_WRITE_TOKEN?.trim() ?? "")?.[1];
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}
