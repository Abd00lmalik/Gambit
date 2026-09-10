import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { getPfpBlobPath } from "@/lib/db";

// Probe order for the legacy path-less fallback — includes `jpeg` (previously
// missing, which made .jpeg uploads 404 forever) and lowercase-only names.
const PROBE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

async function serveBlob(pathname: string): Promise<NextResponse | null> {
  try {
    const url = getDownloadUrl(pathname);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = pathname.split(".").pop() ?? "jpg";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        // Short-lived: images change, and a cached failure must never
        // outlive the fix (see no-store on the 404 below).
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const address = params.address.toLowerCase();

  // 1) Authoritative: the exact blob path recorded on the profile at upload time.
  const storedPath = await getPfpBlobPath(address);
  if (storedPath) {
    const served = await serveBlob(storedPath);
    if (served) return served;
  }

  // 2) Fallback (no DB row / DB down): probe every accepted extension.
  for (const ext of PROBE_EXTS) {
    const served = await serveBlob(`pfps/${address}.${ext}`);
    if (served) return served;
  }

  // Explicitly uncached, so a retry right after an upload is never served
  // from a stale 404. The JSON body doubles as a diagnostic: open this URL
  // directly to see exactly which link failed (no DB path? blob unreadable?).
  return NextResponse.json(
    {
      error: "PFP not found",
      address,
      storedPath: storedPath ?? null,
      probed: storedPath ? PROBE_EXTS.map((e) => `pfps/${address}.${e}`) : [storedPath].filter(Boolean),
    },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}
