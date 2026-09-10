import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { updateProfilePfp } from "@/lib/db";

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

    const blob = await put(pathname, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: true,
    });

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

    const saved = await updateProfilePfp(addr, blob.url);
    if (!saved) {
      console.error("PFP upload: DB save failed for", addr);
      return NextResponse.json(
        { error: "File stored but profile save failed — retry upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({ pfpUrl: blob.url, path: pathname });
  } catch (e: any) {
    console.error("PFP upload error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
