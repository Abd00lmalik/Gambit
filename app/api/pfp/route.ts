import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { updateProfilePfp } from "@/lib/db";

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

    const addr = address.toLowerCase();
    const ext = file.name.split(".").pop() || "jpg";

    const blob = await put(`pfps/${addr}.${ext}`, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });

    await updateProfilePfp(addr, blob.url);

    return NextResponse.json({ pfpUrl: blob.url });
  } catch (e: any) {
    console.error("PFP upload error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
