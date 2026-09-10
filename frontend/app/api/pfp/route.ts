import { NextRequest, NextResponse } from "next/server";
import { putPfp, deleteStalePfps, isValidEvmAddress, savePfpRecord } from "@/lib/pfpStore";

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

    // P3: the storage key is derived ONLY from a validated wallet address.
    // Unvalidated addresses previously allowed bogus keys (e.g. "undefined")
    // to be written and read back shared across wallets.
    if (!isValidEvmAddress(address)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Max 2MB" },
        { status: 400 }
      );
    }

    const result = await putPfp(address, file);

    console.log(`PFP upload: ${address.toLowerCase()} → ${result.pathname} (${file.size} bytes)`);

    // Remove any older blobs for this address under other extensions so reads
    // always resolve to THIS upload, never a stale earlier format.
    await deleteStalePfps(address, result.ext);

    const saved = await savePfpRecord(address, result.url);
    if (!saved) {
      console.error("PFP upload: DB save failed for", address.toLowerCase());
      // The blob itself is stored and per-address — the proxy read path works
      // even if the DB write fails, so don't fail the upload.
    }

    return NextResponse.json({ pfpUrl: result.url, pathname: result.pathname });
  } catch (e: any) {
    console.error("PFP upload error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
