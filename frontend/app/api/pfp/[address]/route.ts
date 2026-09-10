import { NextRequest, NextResponse } from "next/server";
import { getPfpBlob, isValidEvmAddress } from "@/lib/pfpStore";

// P3: per-address proxy read.
//  - Keyed strictly by the requested address (validated), lowercased — there is
//    no shared or generic key, so two wallets can never see each other's image.
//  - Reads private blobs with the correct @vercel/blob API
//    (get(pathname, { access: "private" })). The previous implementation called
//    getDownloadUrl(<pathname>) which throws Invalid URL (it expects a blob
//    URL), so every read failed.
//  - Cache is keyed per unique URL (one per address) with a short TTL + ETag,
//    so updating wallet A never changes what wallet B (or anyone else) sees.
export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const raw = params.address;

  if (!isValidEvmAddress(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const blob = await getPfpBlob(raw);
  if (!blob) {
    return NextResponse.json({ error: "PFP not found" }, { status: 404 });
  }

  const etag = blob.etag;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        // must-revalidate: the store can serve the previous version for ~1s
        // after an overwrite; max-age caching would extend that staleness.
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  }

  return new NextResponse(blob.bytes as any, {
    headers: {
      "Content-Type": blob.contentType,
      "Content-Length": String(blob.bytes.byteLength),
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: etag,
      "X-Pfp-Pathname": blob.pathname,
    },
  });
}
