import { NextResponse } from "next/server";

// Settlement is now manual — winner clicks Claim on the duel page.
// Auto-settlement via keeper cron has been removed.

export async function GET() {
  return NextResponse.json({ ok: true, message: "Settlement is manual. Winner claims via duel page." });
}

export async function POST() {
  return NextResponse.json({ ok: true, message: "Settlement is manual. Winner claims via duel page." });
}
