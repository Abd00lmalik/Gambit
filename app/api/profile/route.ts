import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProfile, getUserDuelsFromDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
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
