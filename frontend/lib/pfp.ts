import { get } from "@vercel/blob";

export type ServeAttempt = { mode: string; status: number; type?: string | null };

/**
 * Read a blob's bytes server-side from a PRIVATE Vercel Blob store.
 *
 * History of what did NOT work, so nobody re-tries it:
 *  - getDownloadUrl(pathname): in the installed SDK this is `new URL(arg)` +
 *    "?download=1" — full URLs only, and no auth at all (403 on private).
 *  - fetch(blob.url + "?token=...") / ?download=1: the private data host only
 *    accepts an Authorization header (VERCEL_OIDC_TOKEN preferred, falling
 *    back to BLOB_READ_WRITE_TOKEN) — query-param auth is not a thing.
 *  - bare fetch(blob.url): 403.
 * The SDK's server-side get() implements exactly that header auth and accepts
 * a store-relative pathname, so it works for paths AND (via pathname
 * extraction) for stored full URLs. Returns bytes + content-type, or null.
 */
export async function fetchBlobServerSide(
  urlOrPathname: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  // Normalize: stored pfp_url may be a full URL (current rows) or the proxy
  // path "/api/pfp/<addr>" (interim rows → null) — accept plain pathnames too.
  let pathname = urlOrPathname;
  if (/^https?:\/\//.test(urlOrPathname)) {
    try {
      pathname = decodeURIComponent(new URL(urlOrPathname).pathname).replace(/^\//, "");
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith("pfps/")) return null;

  const attempts: Array<"private" | "public"> = ["private", "public"];
  for (const access of attempts) {
    try {
      // useCache:false → always the freshest write (avatars overwrite in place).
      const res = await get(pathname, { access, useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) continue;
      const buf = await new Response(res.stream).arrayBuffer();
      if (buf.byteLength === 0) continue;
      const type = res.blob?.contentType || res.headers?.get?.("content-type") || "image/jpeg";
      if (!type.startsWith("image/")) continue;
      return { bytes: buf, contentType: type };
    } catch {
      /* try next access mode */
    }
  }
  return null;
}
