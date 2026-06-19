import { NextResponse } from "next/server";
import { getGrowth } from "@/lib/album/store";
import { ensureHydrated, reloadStore } from "@/lib/demo/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current growth album for Memory: seed + organized photos + ingested Stories.
export async function GET() {
  await ensureHydrated();
  // Always reflect the newest organized photos (growth) and robot/phone uploads
  // (demo) even when this request hits a warm instance that hydrated earlier.
  await Promise.all([reloadStore("growth"), reloadStore("demo")]);
  return NextResponse.json({ growth: getGrowth() });
}
