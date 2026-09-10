import * as blobReal from "@vercel/blob";
import * as dbReal from "@/lib/db";

// ── Per-address PFP storage (P3 fix) ──────────────────────────
// Every blob lives at `pfps/{addressLower}.{ext}` — the CONNECTED wallet's
// address, lowercased, validated. There is no shared or fallback key: two
// wallets can never collide, and overwriting one wallet's PFP can never affect
// another wallet's.
//
// The previous proxy route called `getDownloadUrl(pathname)` — but that API
// takes a BLOB URL (it just appends ?download=1). Called with a raw pathname it
// throws `Invalid URL`, so every proxy read failed and the display path fell
// back to whatever each caller had cached. Reads now go through
// `get(pathname, { access: "private" })`, the correct private-blob API.

// Test seam: tests inject in-memory backends via __setPfpOverrides(). In
// production this is null and the real @vercel/blob / db modules are used.
type BlobApi = typeof blobReal;
type DbApi = { updateProfilePfp: typeof dbReal.updateProfilePfp };
let overrides: { blob?: Partial<BlobApi>; db?: Partial<DbApi> } | null = null;
export function __setPfpOverrides(o: { blob?: Partial<BlobApi>; db?: Partial<DbApi> } | null) {
  overrides = o;
}
const blob = (): typeof blobReal => (overrides?.blob ?? blobReal) as typeof blobReal;
const db = (): DbApi => (overrides?.db ?? dbReal) as DbApi;

export const PFP_PREFIX = "pfps";
export const PFP_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;
export type PfpExtension = (typeof PFP_EXTENSIONS)[number];

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const EXT_FOR_MIME: Record<string, PfpExtension> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function pfpPathname(addressLower: string, ext: string): string {
  return `${PFP_PREFIX}/${addressLower}.${ext}`;
}

export function extForMime(mime: string): PfpExtension | null {
  return EXT_FOR_MIME[mime] ?? null;
}

export function contentTypeForExt(ext: string): string {
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export interface PutPfpResult {
  pathname: string;
  url: string;
  ext: string;
  contentType: string;
}

/**
 * Store a PFP for exactly one wallet address.
 * The storage key is derived ONLY from the (validated, lowercased) address —
 * never from user-supplied filenames.
 */
export async function putPfp(
  address: string,
  file: { name: string; type: string; arrayBuffer(): Promise<ArrayBuffer> }
): Promise<PutPfpResult> {
  if (!isValidEvmAddress(address)) {
    throw new Error("Invalid wallet address");
  }
  const addr = normalizeAddress(address);

  // Extension comes from the server-observed MIME type, falling back to the
  // filename extension only if the MIME type is unknown.
  let ext = extForMime(file.type);
  if (!ext) {
    const fromName = file.name?.split(".").pop()?.toLowerCase() ?? "";
    ext = (PFP_EXTENSIONS as readonly string[]).includes(fromName)
      ? (fromName as PfpExtension)
      : "png";
  }

  const pathname = pfpPathname(addr, ext);
  const contentType = contentTypeForExt(ext);

  const blobApi = blob();
  const stored = await blobApi.put(pathname, await file.arrayBuffer(), {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  } as any);

  return { pathname, url: (stored as any).url, ext, contentType };
}

/**
 * Remove any PFP blobs for this address stored under a DIFFERENT extension, so
 * the read path can never serve a stale image after the user switches format.
 */
export async function deleteStalePfps(address: string, keepExt: string): Promise<void> {
  if (!isValidEvmAddress(address)) return;
  const addr = normalizeAddress(address);
  const stale = (PFP_EXTENSIONS as readonly string[])
    .filter((e) => e !== keepExt)
    .map((e) => pfpPathname(addr, e));
  try {
    await blob().del(stale as any);
  } catch {
    // non-fatal — head() scans tolerate missing blobs
  }
}

export interface PfpBlob {
  bytes: ArrayBuffer;
  contentType: string;
  etag: string;
  pathname: string;
}

/**
 * Read a ReadableStream into an ArrayBuffer without depending on the global
 * Response constructor (works in Node and Edge runtimes alike).
 */
async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

/**
 * Read a wallet's PFP by scanning the per-address keys. Returns null when this
 * exact address has no PFP — never falls back to another key.
 */
export async function getPfpBlob(address: string): Promise<PfpBlob | null> {
  if (!isValidEvmAddress(address)) return null;
  const addr = normalizeAddress(address);

  const blobApi = blob() as any;
  for (const ext of PFP_EXTENSIONS) {
    const pathname = pfpPathname(addr, ext);
    let meta: { contentType?: string; etag?: string; size?: number };
    try {
      meta = await blobApi.head(pathname);
    } catch {
      continue; // not found under this extension
    }
    if (!meta) continue;

    try {
      // @vercel/blob v2 returns a GetBlobResult: { statusCode, stream, headers,
      // blob: { contentType, size, etag, ... } } — it has NO arrayBuffer(). The
      // previous code called res.arrayBuffer(), threw, was swallowed by this
      // catch, and every proxy read 404'd (uploads worked; reads never did).
      const res = await blobApi.get(pathname, { access: "private" });
      if (!res || res.statusCode !== 200 || !res.stream) continue;
      const bytes = await streamToBuffer(res.stream);
      return {
        bytes,
        contentType: res.blob.contentType || meta.contentType || contentTypeForExt(ext),
        etag: meta.etag || res.blob.etag || `"${pathname}-${res.blob.size ?? bytes.byteLength}"`,
        pathname,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Persist the wallet → blob-URL mapping (per-address row). Delegates to lib/db
 * (mockable in tests).
 */
export async function savePfpRecord(address: string, url: string): Promise<boolean> {
  if (!isValidEvmAddress(address)) return false;
  return db().updateProfilePfp(normalizeAddress(address), url);
}
