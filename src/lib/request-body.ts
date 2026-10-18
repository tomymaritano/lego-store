/**
 * A request's body, read with a byte counter: null as soon as it passes
 * `max`, before anything parses it. Content-Length alone is not enough: a
 * chunked request has none, and request.text() or formData() would hold all
 * of it in memory. Throws when the client aborts the request mid-body.
 */
export async function readBodyCapped(request: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    await request.body?.cancel().catch(() => {});
    return null;
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** The same, decoded as UTF-8 text (a webhook's JSON). */
export async function readTextCapped(request: Request, max: number): Promise<string | null> {
  const body = await readBodyCapped(request, max);
  return body === null ? null : new TextDecoder().decode(body);
}
