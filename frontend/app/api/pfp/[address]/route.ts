import { NextRequest, NextResponse } from "next/server";
import { getPfpBlobUrl } from "@/lib/db";
import { fetchBlobServerSide } from "@/lib/pfp";

// Legacy fallback probe set (covers pre-canonicalization uploads that stored
// the raw filename extension, e.g. .jpeg).
const PROBE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

function serve(hit: { bytes: ArrayBuffer; contentType: string }) {
  return new NextResponse(hit.bytes, {
    headers: {
      "Content-Type": hit.contentType,
      // Short-lived: images change, and a cached failure must never outlive
      // the fix (404s are no-store below).
      "Cache-Control": "public, max-age=60",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const address = params.address.toLowerCase();
  const trace: string[] = [];

  // 1) Authoritative: the pfp_url recorded on the profile (full blob URL for
  //    current rows; the reader extracts the pathname and authenticates via
  //    the SDK — private-store URLs are 403 for any unauthenticated fetch).
  const stored = await getPfpBlobUrl(address);
  if (stored && stored.startsWith("http")) {
    trace.push("db-url");
    const hit = await fetchBlobServerSide(stored);
    if (hit) return serve(hit);
    trace.push("db-url:unreadable");
  } else if (stored) {
    trace.push("db:non-url-value");
  }

  // 2) Fallback: deterministic pfps/<addr>.<ext> probe (DB missing/down or an
  //    interim row that stored the proxy path instead of a URL).
  for (const ext of PROBE_EXTS) {
    const hit = await fetchBlobServerSide(`pfps/${address}.${ext}`);
    if (hit) {
      trace.push(`probe:${ext}:ok`);
      return serve(hit);
    }
  }
  trace.push("probes:none");

  // Uncached, so a retry right after an upload is never served from a stale
  // 404; the JSON body doubles as a diagnostic when opened directly.
  return NextResponse.json(
    { error: "PFP not found", address, stored: stored ?? null, trace },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}
