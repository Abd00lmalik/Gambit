import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProfile, getUserDuelsFromDb, updateProfileDisplayName } from "@/lib/db";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  // Debug: check if Supabase env vars are set
  const debug = req.nextUrl.searchParams.get("debug");
  if (debug) {
    return NextResponse.json({
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasNextPublicSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasNextPublicSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.SUPABASE_URL?.slice(0, 30) || "not set",
      envKeys: Object.keys(process.env).filter(k => k.includes("SUPA") || k.includes("POSTGRES") || k.includes("VERCEL")).join(", "),
    });
  }

  try {
    const profile = await getOrCreateProfile(address);
    const duels = await getUserDuelsFromDb(address);
    return NextResponse.json({ profile, duels });
  } catch (e: any) {
    console.error("Profile fetch error:", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, display_name } = body;

    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    if (typeof display_name !== "string") {
      return NextResponse.json({ error: "Invalid display_name" }, { status: 400 });
    }

    const trimmed = display_name.trim();
    if (trimmed.length > 30) {
      return NextResponse.json({ error: "Name too long (max 30 chars)" }, { status: 400 });
    }

    const ok = await updateProfileDisplayName(address, trimmed);
    if (!ok) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, display_name: trimmed });
  } catch (e: any) {
    console.error("Profile update error:", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
