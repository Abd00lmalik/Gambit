// In-memory stand-in for @vercel/blob used ONLY by the PFP route tests.
// Mirrors the surface pfpStore.ts uses: put/get/head/del with private access.
const store = new Map(); // pathname → { bytes: ArrayBuffer, contentType: string, etag: string, uploadedAt: string }

export function __reset() {
  store.clear();
}

export function __dump() {
  return [...store.entries()].map(([pathname, v]) => ({
    pathname,
    contentType: v.contentType,
    size: v.bytes.byteLength,
    etag: v.etag,
  }));
}

export async function put(pathname, body, options = {}) {
  const bytes = body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)).buffer;
  const etag = `"${pathname}-${bytes.byteLength}-${options.contentType ?? ""}"`;
  store.set(pathname, {
    bytes,
    contentType: options.contentType ?? "application/octet-stream",
    etag,
    uploadedAt: new Date().toISOString(),
  });
  return {
    url: `https://mock-store.public.blob.vercel-storage.com/${pathname}`,
    pathname,
    contentType: options.contentType ?? "application/octet-stream",
  };
}

export async function head(pathnameOrUrl) {
  const pathname = String(pathnameOrUrl).replace(/^https:\/\/[^/]+\//, "");
  const entry = store.get(pathname);
  if (!entry) {
    const err = new Error(`BlobNotFoundError: ${pathname}`);
    err.name = "BlobNotFoundError";
    throw err;
  }
  return {
    url: `https://mock-store.public.blob.vercel-storage.com/${pathname}`,
    downloadUrl: `https://mock-store.public.blob.vercel-storage.com/${pathname}?download=1`,
    pathname,
    size: entry.bytes.byteLength,
    contentType: entry.contentType,
    contentDisposition: null,
    cacheControl: "",
    uploadedAt: new Date(entry.uploadedAt),
    etag: entry.etag,
  };
}

export async function get(pathnameOrUrl, options = {}) {
  if (!options || (options.access !== "private" && options.access !== "public")) {
    throw new Error('access must be "private" or "public"');
  }
  const pathname = String(pathnameOrUrl).replace(/^https:\/\/[^/]+\//, "");
  const entry = store.get(pathname);
  if (!entry) {
    const err = new Error(`BlobNotFoundError: ${pathname}`);
    err.name = "BlobNotFoundError";
    throw err;
  }
  // Mirror the real @vercel/blob v2 GetBlobResult shape: a discriminated union
  // with { statusCode, stream, headers, blob: { ...meta } } — NOT a Response.
  const bytes = entry.bytes instanceof ArrayBuffer ? new Uint8Array(entry.bytes) : new TextEncoder().encode(String(entry.bytes));
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return {
    statusCode: 200,
    stream,
    headers: new Headers({ "Content-Type": entry.contentType, ETag: entry.etag }),
    blob: {
      url: `https://mock-store.public.blob.vercel-storage.com/${pathname}`,
      downloadUrl: `https://mock-store.public.blob.vercel-storage.com/${pathname}?download=1`,
      pathname,
      contentDisposition: null,
      cacheControl: "",
      uploadedAt: new Date(entry.uploadedAt),
      etag: entry.etag,
      contentType: entry.contentType,
      size: entry.bytes.byteLength,
    },
  };
}

export async function del(pathnames) {
  const list = Array.isArray(pathnames) ? pathnames : [pathnames];
  for (const p of list) {
    const pathname = String(p).replace(/^https:\/\/[^/]+\//, "");
    store.delete(pathname);
  }
}
