import { NextRequest, NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { getPfpBlobUrl } from "@/lib/db";
import { fetchBlobServerSide } from "@/lib/pfp";

// Legacy fallback probe set (covers pre-canonicalization uploads that stored
// the raw filename extension, e.g. .jpeg).
const PROBE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

async function resolveHeadUrl(pathname: string): Promise<string | null> {
  try {
    const meta = await head(pathname);
    return meta?.url ?? null;
  } catch {
    return null; // not found / store error — try next
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const address = params.address.toLowerCase();
  const trace: string[] = [];

  // 1) Authoritative: the exact blob URL recorded on the profile at upload
  //    time (full URL for rows written by the current POST).
  const stored = await getPfpBlobUrl(address);
  if (stored) {
    if (stored.startsWith("http")) {
      trace.push("db-url");
      const hit = await fetchBlobServerSide(stored);
      if (hit) return serve(hit);
      trace.push("db-url:unreadable");
    } else {
      // Interim rows stored the proxy path itself ("/api/pfp/<addr>") —
      // deterministic layout lets us rebuild the blob path.
      trace.push("db:proxy-path");
    }
  }

  // 2) Fallback: probe the deterministic paths via head() to obtain real blob
  //    URLs (works even when the DB is down or holds a legacy value).
  for (const ext of PROBE_EXTS) {
    const pathname = `pfps/${address}.${ext}`;
    const url = await resolveHeadUrl(pathname);
    if (!url) continue;
    trace.push(`probe:${ext}`);
    const hit = await fetchBlobServerSide(url);
    if (hit) return serve(hit);
    trace.push(`probe:${ext}:unreadable`);
  }

  // Explicitly uncached, so a retry right after an upload is never served
  // from a stale 404. The JSON body doubles as a diagnostic.
  return NextResponse.json(
    { error: "PFP not found", address, stored, trace },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

function serve(hit: { res: Response; attempt: { mode: string; status: number; type?: string | null } }) {
  return hit.res.arrayBuffer().then((buf) => {
    return new NextResponse(buf, {
      headers: {
        "Content-Type": hit.attempt.type ?? "image/jpeg",
        // Short-lived: images change, and a cached failure must never
        // outlive the fix (404s are no-store below).
        "Cache-Control": "public, max-age=60",
        "X-Pfp-Served-By": hit.attempt.mode,
      },
    });
  });
}
