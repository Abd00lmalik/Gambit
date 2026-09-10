// Shared server-side blob fetch used by both PFP routes. Kept OUT of the
// route files because Next.js route.ts may only export HTTP handlers.
export type ServeAttempt = { mode: string; status: number; type?: string | null };

/**
 * Fetch a blob server-side through every auth mode this store might allow.
 * IMPORTANT: do NOT use getDownloadUrl(path) — in the installed @vercel/blob
 * it is `new URL(blobUrl)` + `?download=1`, i.e. it needs a FULL URL and
 * threw "Invalid URL" for relative paths (the root cause of every proxy 404
 * during this bug's history). The URL we get back from put() is canonical.
 */
export async function fetchBlobServerSide(
  blobUrl: string
): Promise<{ res: Response; attempt: ServeAttempt } | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const variants: Array<{ mode: string; url: string }> = [];
  try {
    const base = new URL(blobUrl);
    variants.push({ mode: "plain", url: base.toString() });
    const dl = new URL(blobUrl);
    dl.searchParams.set("download", "1");
    variants.push({ mode: "download", url: dl.toString() });
    if (token) {
      const tk = new URL(blobUrl);
      tk.searchParams.set("token", token);
      variants.push({ mode: "token", url: tk.toString() });
      const both = new URL(tk.toString());
      both.searchParams.set("download", "1");
      variants.push({ mode: "token+download", url: both.toString() });
    }
  } catch {
    return null; // not a full URL — caller must resolve via head()/DB first
  }
  for (const v of variants) {
    try {
      const res = await fetch(v.url, { signal: AbortSignal.timeout(5000) });
      const type = res.headers.get("content-type");
      if (res.ok && (type ?? "").startsWith("image/")) {
        return { res, attempt: { mode: v.mode, status: res.status, type } };
      }
    } catch {
      /* try next mode */
    }
  }
  return null;
}
