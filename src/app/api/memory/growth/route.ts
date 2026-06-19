import { NextResponse } from "next/server";
import { getGrowth } from "@/lib/album/store";
import { ensureHydrated } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current growth album for Memory: seed + anything organized this session.
export async function GET() {
  await ensureHydrated();
  return NextResponse.json({ growth: getGrowth() });
}
