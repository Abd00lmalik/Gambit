import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const address = params.address.toLowerCase();

  // Try common extensions
  for (const ext of ["jpg", "png", "webp", "gif"]) {
    try {
      const pathname = `pfps/${address}.${ext}`;
      const url = getDownloadUrl(pathname);
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType =
          ext === "jpg" ? "image/jpeg" :
          ext === "png" ? "image/png" :
          ext === "webp" ? "image/webp" :
          "image/gif";

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=60",
          },
        });
      }
    } catch {
      // try next extension
    }
  }

  return NextResponse.json({ error: "PFP not found" }, { status: 404 });
}
