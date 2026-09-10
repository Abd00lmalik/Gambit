import { NextRequest, NextResponse } from "next/server";
import { put, del, getDownloadUrl } from "@vercel/blob";
import { updateProfilePfp, getPfpBlobPath } from "@/lib/db";

// Canonical extension per accepted MIME type. The stored extension is derived
// from the file's MIME type — never from the raw filename — so what we save
// here always matches what the GET proxy probes (previously `photo.jpeg` /
// `IMG_0001.JPG` stored paths the proxy couldn't find → placeholder flicker).
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

    // The project's blob store is configured PRIVATE — asking for "public"
    // throws "Cannot use public access on a private store". Private is fine:
    // the GET proxy signs a download URL server-side via getDownloadUrl().
    // If the store is ever flipped to public, the retry below keeps uploads
    // working without a code change.
    let blob: Awaited<ReturnType<typeof put>>;
    try {
      blob = await put(pathname, file, {
        access: "private",
        contentType: file.type,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    } catch (e: any) {
      if (String(e?.message).includes("private")) {
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

    // Remove blobs stored under other extensions for this address so the proxy
    // can never serve a stale previous image, then persist the exact path.
    for (const other of Object.values(EXT_BY_MIME)) {
      if (other === ext) continue;
      try {
        await del(`pfps/${addr}.${other}`);
      } catch {
        // not present — fine
      }
    }

    // Store the PROXY path (not the raw blob URL) as pfp_url: on a private
    // store the raw URL 403s for every browser-side consumer, while the proxy
    // resolves the exact blob server-side via getDownloadUrl(). getPfpBlobPath
    // falls through to the deterministic pfps/<addr>.* probe for these rows.
    const saved = await updateProfilePfp(addr, `/api/pfp/${addr}`);
    if (!saved) {
      console.error("PFP upload: DB save failed for", addr);
      return NextResponse.json(
        { error: "File stored but profile save failed — retry upload", detail: { path: pathname, blobUrl: blob.url } },
        { status: 500 }
      );
    }

    // ── Server-side self-verification ────────────────────────────
    // Read back through the SAME primitives the GET proxy uses
    // (DB path lookup → getDownloadUrl → fetch). If this succeeds, the
    // avatar is guaranteed to render everywhere — no optimistic toasts.
    const diag: Record<string, unknown> = { path: pathname, dbSaved: saved === true };
    try {
      const storedPath = await getPfpBlobPath(addr);
      const readPath = storedPath ?? pathname;
      const dl = getDownloadUrl(readPath);
      const back = await fetch(dl, { signal: AbortSignal.timeout(5000) });
      diag.storedPath = storedPath;
      diag.readbackStatus = back.status;
      diag.readbackType = back.headers.get("content-type");
      if (!back.ok || !(back.headers.get("content-type") ?? "").startsWith("image/")) {
        return NextResponse.json(
          { error: "Image saved but not readable back yet — check Vercel Blob store access", detail: diag },
          { status: 502 }
        );
      }
    } catch (e: any) {
      diag.readbackError = String(e?.message ?? e).slice(0, 160);
      return NextResponse.json(
        { error: "Image saved but readback failed (blob or DB unreachable from server)", detail: diag },
        { status: 502 }
      );
    }

    return NextResponse.json({
      pfpUrl: `/api/pfp/${addr}`,
      path: pathname,
      proxyUrl: `/api/pfp/${addr}`,
      verified: true, // proxy read-back verified against this exact blob
    });
  } catch (e: any) {
    console.error("PFP upload error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
