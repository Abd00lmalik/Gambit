import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { updateProfilePfp } from "@/lib/db";
import { fetchBlobServerSide } from "@/lib/pfp";

// Canonical extension per accepted MIME type. The stored extension is derived
// from the file's MIME type — never from the raw filename — so what we save
// here always matches what the GET proxy probes.
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const address = formData.get("address") as string | null;

    if (!file || !address) {
      return NextResponse.json(
        { error: "Missing file or address" },
        { status: 400 }
      );
    }

    const ext = EXT_BY_MIME[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, Webp, GIF" },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Max 2MB" },
        { status: 400 }
      );
    }

    const addr = address.toLowerCase();
    const pathname = `pfps/${addr}.${ext}`;

    console.log(`PFP upload: ${addr}, type=${file.type}, size=${file.size}, path=${pathname}`);

    // The store is configured PRIVATE; explicit "private" is honored, and if
    // the store is ever flipped public the retry covers us. put() returns the
    // canonical full URL (+ signed downloadUrl) we serve through the proxy.
    let blob: Awaited<ReturnType<typeof put>>;
    try {
      blob = await put(pathname, file, {
        access: "private",
        contentType: file.type,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    } catch (e: any) {
      if (String(e?.message).toLowerCase().includes("private")) {
        blob = await put(pathname, file, {
          access: "public",
          contentType: file.type,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
      } else {
        throw e;
      }
    }

    console.log(`PFP blob stored: ${blob.url}`);

    // Remove blobs stored under other extensions so the proxy can never serve
    // a stale previous image.
    for (const other of Object.values(EXT_BY_MIME)) {
      if (other === ext) continue;
      try {
        await del(`pfps/${addr}.${other}`);
      } catch {
        // not present — fine
      }
    }

    // Store the RAW blob URL (full, no token) — the GET proxy re-reads it
    // server-side through the same auth ladder we verify below.
    const saved = await updateProfilePfp(addr, blob.url);
    if (!saved) {
      console.error("PFP upload: DB save failed for", addr);
      return NextResponse.json(
        { error: "File stored but profile save failed — retry upload", detail: { path: pathname, blobUrl: blob.url } },
        { status: 500 }
      );
    }

    // ── Server-side self-verification ────────────────────────────
    // Read the image back through the SAME mechanism the GET proxy uses. The
    // success toast is only allowed once this passes.
    const readback = await fetchBlobServerSide(blob.url);
    if (!readback) {
      return NextResponse.json(
        {
          error: "Image stored but not readable server-side yet — check Vercel Blob store access",
          detail: { path: pathname, url: blob.url, note: "all auth modes failed or non-image content-type" },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      pfpUrl: `/api/pfp/${addr}`,
      path: pathname,
      proxyUrl: `/api/pfp/${addr}`,
      verified: true,
      via: readback.attempt.mode,
    });
  } catch (e: any) {
    console.error("PFP upload error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
